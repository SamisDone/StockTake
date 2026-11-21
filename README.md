# Stocktake

An inventory system whose stock levels you can audit. Every unit on hand traces back to a movement in an append-only ledger, and the database itself refuses any write that would break that.

Stocktake rebuilds [StockMaster](https://github.com/SamisDone/StockMaster-Main), a PHP and MySQL course project (CSE 252), on Next.js, Cloudflare Workers and D1.

**Live:** https://stocktake.stocktake-app.workers.dev. Open the demo from the landing page as an admin or as staff; no sign-up needed. The app has the dashboard, products, purchase orders, suppliers, the activity log and analytics; the AI assistant is being built.

## What it does

- **Stock ledger.** Receipts, sales, returns, write-offs and count adjustments, each recorded as a signed movement. A product's on-hand count is a denormalised copy of its ledger total.
- **Purchase orders.** Draft → ordered → received, or cancelled. Receiving books one receipt per line, atomically.
- **Forecasting.** Days of cover from the last 28 days of net demand, with reorder suggestions that account for stock already on order and each supplier's lead time.
- **Suppliers.** Lead times, and one 1–5 star review per person.
- **Activity log.** Who did what, append-only.
- **Analytics.** A period's stock reconciled from the ledger (opening stock plus every movement equals what's on hand, checked against the products' own counts), sales by day, a breakdown by category, and the best and slowest sellers. Sales are valued at today's list prices, since the ledger records units.
- **Roles.** Admins manage the catalog and place or cancel orders; staff record stock and receive deliveries.

## How the integrity works

The rules live in the database, in [`drizzle/0001_ledger_rules.sql`](drizzle/0001_ledger_rules.sql), so no application bug can get around them:

- Inserting a movement updates `products.on_hand` through a trigger. `on_hand` starts at zero, can't go negative (`CHECK (on_hand >= 0)`), and can't be set to anything but the ledger total.
- Movements and activity entries can't be updated or deleted. A correction is a new adjustment.
- Purchase orders can only make the allowed status changes. Their lines lock once placed, and a receipt must match its line's product and quantity.
- Each order line can be received once (a unique index), and the order can only be marked received once every line has its receipt. Receiving the same order twice, even concurrently, fails as a whole.

D1 has no interactive transactions, so multi-statement writes use `db.batch()`, which is atomic. Each rule has a test in [`src/db/schema.test.ts`](src/db/schema.test.ts) that runs the real migrations. The refusals quoted on the landing page are tested the same way ([`src/lib/refusals.test.ts`](src/lib/refusals.test.ts)), so the page can't claim a rule the database doesn't enforce.

## Stack

- Next.js 16 (App Router, Cache Components) on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare)
- Cloudflare D1 (SQLite) with Drizzle ORM
- Session auth: PBKDF2-SHA256 password hashes through WebCrypto, and random session tokens of which only the SHA-256 is stored. A data-access layer re-checks the session next to the data on every page and Server Action; `proxy.ts` only redirects visitors with no session cookie
- Tests: Vitest on in-memory libsql, with the same migrations as production

## Run it locally

You need Node.js 22.18 or newer and pnpm (`corepack enable` provides it).

```bash
pnpm install
pnpm db:migrate:local   # create the tables and rules in a local D1 database
pnpm db:seed:local      # load the demo dataset (repeatable; it resets first)
pnpm dev                # http://localhost:3000
```

The local database lives in `.wrangler/state/` and needs no Cloudflare account. `next dev` reaches it through the same `DB` binding as production.

The demo dataset is 120 days of simulated trading for a small distributor, generated deterministically and ending yesterday. It includes two demo people, both with the password `stocktake-demo`:

| Email                  | Role  |
| ---------------------- | ----- |
| `admin@stocktake.demo` | Admin |
| `staff@stocktake.demo` | Staff |

### Other commands

| Command            | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| `pnpm test`        | Run the test suite                                                         |
| `pnpm typecheck`   | Generate route types and type-check                                        |
| `pnpm lint`        | ESLint                                                                     |
| `pnpm format`      | Prettier                                                                   |
| `pnpm preview`     | Build the Worker and serve it locally in workerd, as it runs in production |
| `pnpm db:generate` | Generate a migration after changing `src/db/schema.ts`                     |
| `pnpm cf-typegen`  | Regenerate binding types after changing `wrangler.jsonc`                   |

Use `pnpm preview` rather than `wrangler dev` to test the Worker build. It also fills the static-asset cache, and without that step the first request hangs.

## Deploy

Deploying needs a Cloudflare account (the free plan is enough) and `pnpm wrangler login`.

```bash
pnpm wrangler d1 create stocktake    # once; put the printed database_id in wrangler.jsonc
pnpm db:migrate:remote
pnpm db:seed:remote                  # optional: the demo dataset
pnpm run deploy                      # not `pnpm deploy`, which is a built-in pnpm command
```

After that, every push to `main` that passes the checks deploys itself: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) applies new D1 migrations, then builds and deploys the Worker. It needs two repository secrets, `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and D1: Edit) and `CLOUDFLARE_ACCOUNT_ID`.

## Project layout

```
drizzle/          migrations, including the ledger rules
scripts/          the demo seed runner
src/app/          routes: (marketing) landing, (auth) login, (app) the signed-in app
src/components/   shared UI: page transitions, page header, demo sign-in
src/db/           schema, the D1 client and the database type
src/domain/       business logic: stock, purchase orders, forecasting, catalog, auth
src/lib/          formatting, and the landing page's tested list of refused writes
src/server/       the data-access layer, session cookie, and Server Actions
src/seed/         the demo dataset generator
src/proxy.ts      the optimistic signed-out redirect
src/test/         test database and fixtures
```
