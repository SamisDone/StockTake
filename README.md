<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/mark-dark.svg">
  <img src="docs/readme/mark-light.svg" width="72" height="72" alt="The Stocktake mark: a thermal label with a small running total cut through it">
</picture>

# Stocktake

**Stock you can prove.** An inventory system where every unit on hand traces back to a line in an append-only ledger, and the database itself refuses any write that would make the two disagree. On top sits Ask, an assistant that answers questions about the stock by looking things up. It can read, but it can never change anything.

[![CI](https://github.com/SamisDone/stocktake/actions/workflows/ci.yml/badge.svg)](https://github.com/SamisDone/stocktake/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16.4-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19.3-149eca?logo=react&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1-f38020?logo=cloudflare&logoColor=white)
![Workers AI](<https://img.shields.io/badge/AI-Workers%20AI%20(GLM--4.7%20Flash)-f38020>)
![Tests](https://img.shields.io/badge/tests-484%20passing-2ea44f)
![Cost](https://img.shields.io/badge/runs%20on-free%20tiers-555)

**[Open the live demo →](https://stocktake.web-applications.workers.dev)**<br>
<sub>One click signs you in as an admin or as staff. No account needed. The demo starts over every night at midnight, Dhaka time.</sub>

<br>

<img src="docs/readme/hero.gif" width="880" alt="The front page opening: the name types itself out, the headline rises, a receipt prints, and an UPDATE that tries to set on_hand to 120 is stamped 'on_hand must match the stock ledger' by the database">

<sub>The front page runs real database refusals. Each message is checked word for word by a test against the actual migrations.</sub>

</div>

---

## Contents

- [What it is](#what-it-is)
- [A tour](#a-tour)
- [How the integrity works](#how-the-integrity-works)
- [How Ask works](#how-ask-works)
- [Architecture](#architecture)
- [Engineering notes](#engineering-notes)
- [Run it locally](#run-it-locally)
- [Deploy](#deploy)
- [Project layout](#project-layout)
- [Where it came from](#where-it-came-from)

## What it is

Stocktake is a full-stack inventory app for a small distributor. It runs the whole loop: products, stock counts, sales to customers on account, purchase orders and deliveries, suppliers, analytics and an audit trail. Three ideas run through it:

1. **The ledger is the truth.** Stock never "changes"; it moves. Receipts, sales, returns, write-offs, count corrections, supplier returns and undos are each a signed line in `stock_movements`. A product's on-hand number is only a cached total of its ledger, and SQLite triggers make sure it can never be anything else.
2. **The AI can look, not touch.** Ask answers questions through nine typed, read-only tools. The model never writes SQL. When it suggests a purchase order, a person reviews the lines and writes the draft through the same checks as the rest of the app.
3. **Everything runs for free.** It's built to fit Cloudflare's free plans (Workers, D1, Workers AI), and that constraint shaped real decisions: a daily AI allowance, prerendered pages, CPU budgets per request.

It's a rebuild of a university course project ([StockMaster](https://github.com/SamisDone/StockMaster-Main), PHP and MySQL, CSE 252), redone from the schema up.

## A tour

### Dashboard: what needs attention

Out of stock, running low before a delivery could arrive, and what reordering would cost. "Cover" is how long stock lasts at the last 28 days' sales. The mark on each bar is the supplier's lead time, so a bar short of its mark runs out before a new order can land.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/dashboard-dark.png">
  <img src="docs/readme/dashboard-light.png" width="880" alt="The admin dashboard: tallies for out of stock, reorder now and cost to reorder, then a table of products needing attention with cover bars against each supplier's lead time">
</picture>

<sub>The image follows your GitHub theme. The app has a light and a dark theme, plus a System setting.</sub>

Staff get a different home: deliveries due (late ones first, with the supplier's phone), shelves that haven't been counted in 30 days, and what they've recorded today.

### Products and the ledger

A product opens as a drawer over the list and keeps a shareable URL; reload it and you get the full page. Recording a sale, return, write-off or count adds a line to the ledger. The new line prints in, On hand counts down, and a toast offers **Undo**. Undo doesn't delete anything: it appends a reversing line, because the ledger only grows.

<img src="docs/readme/record.gif" width="880" alt="Opening a product in the drawer, recording a sale of 4, the ledger line printing in and On hand going from 95 to 91, then Undo adding a reversing line and marking the sale Undone">

<details>
<summary>The product drawer, still</summary>
<br>
<img src="docs/readme/product-drawer.png" width="880" alt="The product drawer: on hand, cover against lead time and on order, the status sentence, demand, reorder point, unit cost and margin, and the Record stock form">
</details>

### Sales, customers and dues

A sale has several priced lines, a discount per line and on the whole sale, and a customer who can pay part now and owe the rest. Money paid at a sale settles that sale; payments taken later settle the oldest open sale first, the way a shop's credit book works. Voiding a sale (admins only) puts its stock back through reversing ledger lines.

<img src="docs/readme/sale.gif" width="880" alt="Recording a sale for Nadia Akter: two products added from the search, $10 paid of $20.48, the due line turning yellow, then the recorded sale showing $10.48 due on her account">

<table>
  <tr>
    <td><img src="docs/readme/sales.png" alt="The sales list: today, last 28 days and owed by customers, then each sale with its customer, date, lines, total and what's still due"></td>
    <td><img src="docs/readme/customer.png" alt="A customer's page: bought, paid and due, a form to take a payment, their sales with what's left on each, and their payments"></td>
  </tr>
</table>

### Purchase orders: draft → placed → received

**Suggested orders** group what's running low by supplier, each at enough to last the supplier's lead time plus another 30 days, less what's on hand and on order (never under the product's reorder quantity). One click turns a supplier's suggestions into a draft. A draft can be edited line by line, then placed, which locks its lines. Deliveries can arrive in parts. An order closes when everything is in, or an admin closes it short; stock can also go back to the supplier. Each order prints as an A4 purchase order.

<img src="docs/readme/receive.gif" width="880" alt="Receiving the rest of a late order: the yellow 'partly in, the rest late' band, Receive delivery, and the order stamped Received with a toast">

<table>
  <tr>
    <td><img src="docs/readme/orders.png" alt="The orders list with suggested orders folded into a summary, status marks, and late orders pinned to the top"></td>
    <td><img src="docs/readme/supplier.png" alt="A supplier's page: lead time, products running low, on-time delivery record, rating, recent orders and reviews"></td>
  </tr>
</table>

### Analytics that reconcile

Each period's figures are rebuilt from the ledger: stock at the start, plus every movement since, must equal what's on hand now, and the page says whether it does. There are also sales by day, where the stock went (sold, written off, missing at counts, still on the shelves), supplier delivery times against their quoted lead time, and margin by category. Priced sales count at what they actually sold for, after discounts.

<img src="docs/readme/analytics.png" width="880" alt="Analytics: sales, gross margin, stock at cost and lost stock for the last 28 days, then the stock-at-cost chart that ends on today's closing figure">

### Ask, the assistant

Questions in plain words, answered by a model that can only look things up. Each lookup prints as it runs, the answer streams in, and every product, order, supplier or customer it names becomes a link. Links only come from records the tools actually returned, never from the model's text. Ask can also propose an order, which you check and write yourself.

<img src="docs/readme/ask.gif" width="880" alt="Asking 'What should I reorder this week, and from whom?': lookups for products, suppliers and two proposed orders print one by one, then a linked answer and a proposed order for Greenfield Paper Goods with a Write this draft button">

### Fast for people who use it all day

<kbd>Ctrl</kbd> <kbd>K</kbd> opens a palette over everything: products, orders, suppliers, customers, pages and actions. It opens instantly, with no animation, because a tool used hundreds of times a day shouldn't make you wait. <kbd>R</kbd> opens Record stock from anywhere.

<img src="docs/readme/palette.gif" width="880" alt="Pressing Ctrl+K on the dashboard, typing 'hex', and opening Hex bolts M8 in the drawer">

### On a phone

A tab bar with Record in the middle, a More sheet for the rest, and tables that fold into labelled rows.

<img src="docs/readme/phones.png" width="880" alt="Three phone screens: the staff home with deliveries to receive, the products list in the dark theme, and a new sale">

### বাংলা and taka

Every screen reads in English or Bangla, including dates, Bangla digits, lakh grouping and the assistant's answers. Money reads in US dollars or Bangladeshi taka, converted at a daily rate. Times and day boundaries follow the business's clock, Asia/Dhaka.

<table>
  <tr>
    <td><img src="docs/readme/dashboard-bangla.png" alt="The dashboard in Bangla with amounts in taka"></td>
    <td><img src="docs/readme/analytics-bangla.png" alt="Analytics in Bangla: sales, margin and stock in taka with Bangla digits and lakh grouping"></td>
  </tr>
</table>

<details>
<summary>More screens: activity, people, a sale, an order</summary>
<br>
<img src="docs/readme/activity.png" width="880" alt="The activity log: one week per page, grouped by day, a run of one person's sales folded into one row">
<img src="docs/readme/people.png" width="880" alt="People: the team with roles, add a person with a temporary password, change roles and reset passwords">
<img src="docs/readme/sale.png" width="880" alt="A sale: its lines, total, what's due on the customer's account, and its history">
<img src="docs/readme/order.png" width="880" alt="A purchase order: status, lines with what's been received, total and history">
</details>

## How the integrity works

The rules live in the database, as SQLite triggers in [`drizzle/`](drizzle), so no bug in the app, and no hand-written query, can get around them. The app only ever inserts.

```mermaid
flowchart LR
    A[Server Action<br>record a sale] --> B[INSERT INTO stock_movements]
    B --> C{Triggers}
    C -->|sign matches the kind<br>product isn't archived<br>sale line matches| D[products.on_hand += quantity]
    D --> E{on_hand >= 0<br>and equals the ledger total?}
    E -->|yes| F[(committed)]
    E -->|no| G[ABORT: on_hand must match<br>the stock ledger]
    C -->|rule broken| G
```

- **On hand is the ledger total.** Inserting a movement updates `products.on_hand` through a trigger. On hand starts at 0, can't go negative (`CHECK (on_hand >= 0)`), and can't be set to anything but the sum of its movements.
- **Append-only history.** Movements, sales, sale lines, payments and the activity log can't be updated or deleted. A mistake is corrected by a new line: an adjustment, an undo (a reversing line, at most once, same product, opposite quantity) or a voided sale.
- **Purchase orders follow a state machine.** Draft → ordered → received, or cancelled. Lines lock once an order is placed. A receipt can't exceed what's still due on its line, an order only counts as received once something has come in, and it can't be cancelled after stock arrived. Supplier returns never exceed what was received less what's already gone back.
- **Sales and dues hold together.** A sale's stock line must match its priced line. A payment can never exceed what the customer owes, so two people taking the last of a due at the same moment can't both succeed.
- **Archived products are frozen.** They can't take new movements or order lines, and a product on an open order can't be archived.

D1 has no interactive transactions, so every multi-step write is one atomic `db.batch()`. Each rule has a test in [`src/db/schema.test.ts`](src/db/schema.test.ts) that runs the real migrations on in-memory SQLite. The refusals quoted on the landing page are tested the same way ([`src/lib/refusals.test.ts`](src/lib/refusals.test.ts)), so the marketing can't claim a rule the database doesn't enforce.

## How Ask works

Ask runs on [Workers AI](https://developers.cloudflare.com/workers-ai/) with `@cf/zai-org/glm-4.7-flash` (fallback `@cf/google/gemma-4-26b-a4b-it`, both set in [`src/assistant/config.ts`](src/assistant/config.ts)) through the Worker's `AI` binding, so there's no API key to leak.

```mermaid
sequenceDiagram
    participant P as Person
    participant W as Worker (POST /api/ask)
    participant M as Model (Workers AI)
    participant T as Tools (read-only, zod-validated)
    participant D as D1
    P->>W: question
    W->>W: session check, daily allowance claimed
    loop up to 5 model calls
        W->>M: messages + 9 tool definitions (streamed)
        M-->>W: tool call, e.g. search_products {status: "reorder"}
        W->>T: parse arguments with zod
        T->>D: typed query through the domain layer
        D-->>T: rows
        T-->>W: figures pre-formatted, records to link
        W-->>P: "lookup" event: what was looked up
    end
    M-->>W: answer text (streamed)
    W-->>P: "text" events, then the answer with links<br>to records the tools returned
```

- **Nine tools** ([`src/assistant/tools.ts`](src/assistant/tools.ts)): `search_products`, `get_product`, `list_suppliers`, `get_supplier`, `list_orders`, `get_order`, `sales_summary`, `list_customers`, `draft_purchase_order`. Each is a typed query over the same domain functions the pages use. A malformed call goes back to the model as an error it can correct; it never throws.
- **Numbers are handed over formatted** (money as text in the reader's currency, dates as the pages print them), so the model repeats figures instead of computing them.
- **Proposals write nothing.** `draft_purchase_order` returns lines; the person writes the draft through the normal Server Action and domain checks.
- **Untrusted text stays data.** Product descriptions, notes and supplier reviews come back inside tool results, and the system prompt tells the model to report them, never follow them. Answers render through a small, safe Markdown subset, so a model can't inject markup.
- **It stays free.** The free plan gives 10,000 neurons a day, and a question costs about 40–50. Each person gets 20 questions a day; all accounts share a budget kept under the allowance. A question is counted before the model is called and refunded if no answer comes, and when either limit is reached the page says so plainly.

## Architecture

```mermaid
flowchart TB
    subgraph Browser
      UI[React 19 · App Router<br>route groups, intercepted drawer,<br>view transitions]
    end
    subgraph Worker["Cloudflare Worker · Next.js on OpenNext"]
      Proxy[proxy.ts<br>optimistic signed-out redirect]
      RSC[Server Components<br>Cache Components + Suspense]
      SA[Server Actions · Route Handlers]
      DAL[Data-access layer<br>re-checks the session next to the data]
      Domain[Domain layer<br>stock · sales · orders · forecast · analytics]
      Cron[Cron Trigger<br>midnight Dhaka: demo reset]
    end
    D1[(D1 · SQLite<br>ledger rules as triggers)]
    AI[Workers AI]
    FX[Daily exchange rate<br>currency-api]
    UI --> Proxy --> RSC
    UI --> SA
    RSC --> DAL
    SA --> DAL
    DAL --> Domain --> D1
    SA -->|/api/ask| AI
    RSC -.->|stale rate refreshed in waitUntil| FX
    Cron --> D1
```

| Layer     | Choice                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 App Router with Cache Components, `typedRoutes`, route groups `(marketing)`, `(auth)`, `(app)`, `(print)`, and an intercepting route that opens a product as a drawer with its own URL |
| Hosting   | Cloudflare Workers through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare); prerendered shells served from Workers static assets                                                     |
| Data      | Cloudflare D1 with Drizzle ORM (`sqlite-core`), 11 migrations, rules enforced by triggers                                                                                                           |
| Auth      | Own sessions: random tokens stored only as SHA-256, httpOnly cookies, PBKDF2-SHA256 password hashes through WebCrypto (argon2 doesn't run on Workers), roles `admin` and `staff`                    |
| AI        | Workers AI binding, streamed tool calling, zod-validated read-only tools                                                                                                                            |
| UI        | Tailwind CSS 4, hand-built charts in SVG, cmdk for the palette, Sonner for toasts, Lucide icons                                                                                                     |
| Tests     | Vitest on in-memory libsql with the production migrations: 484 tests                                                                                                                                |
| CI/CD     | GitHub Actions: typecheck, lint, format, test; then migrate D1 and deploy on every push to `main`                                                                                                   |

## Engineering notes

A few decisions worth knowing about:

- **Business time.** The demo business is in Dhaka. "Today", analytics days, late deliveries, the assistant's daily allowance and the nightly reset all follow Asia/Dhaka through one constant. Dhaka has no daylight saving, so day maths is plain addition, even in SQL.
- **Page frames never wait on the request.** Under Cache Components, a page's frame (title, actions, placeholders) is prerendered, and anything that reads the session or the database streams in inside `<Suspense>`. Navigations start in about 5 ms and the drawer opens in about 40 ms, instead of waiting a round trip.
- **Motion with a job.** Every animation explains something: a ledger line printing in, On hand counting, an order being stamped Received, a section's entry number typing out. All of it respects `prefers-reduced-motion`. The command palette deliberately has none.
- **Bilingual, all the way down.** Copy sits beside its code as `{ en, bn }` objects, with Bangla typed against English's shape so a missing string fails typecheck. Domain refusals carry a key and facts, not a sentence, so the reader sees them in their language. Activity entries store facts too, and are rendered in the reader's language later.
- **Free-plan limits are real limits.** D1's free plan allows 5 million rows read per day, for the whole account. One migration that rebuilt the ledger table read about 10 million: dropping the old table checked each row's self-reference against an unindexed column. That stopped the live demo until midnight UTC. A test now fails any migration that would repeat it ([`src/db/migrations.test.ts`](src/db/migrations.test.ts)).
- **The demo resets itself.** A Cron Trigger rebuilds the demo data at midnight in Dhaka in one atomic batch. The seed is deterministic, so the data always ends yesterday and always tells the same story.

## Run it locally

You need Node.js 22.18 or newer and pnpm (`corepack enable` provides it).

```bash
pnpm install
pnpm db:migrate:local   # create the tables and rules in a local D1 database
pnpm db:seed:local      # load the demo dataset (repeatable; it resets first)
pnpm dev                # http://localhost:3000
```

The local database lives in `.wrangler/state/` and needs no Cloudflare account; `next dev` reaches it through the same `DB` binding as production. Ask is the exception: Workers AI always runs on Cloudflare, so it needs `pnpm wrangler login`, and questions asked locally count against your account's daily allowance.

The demo dataset is 120 days of simulated trading for a small distributor: 30 products from six suppliers, about 3,200 ledger movements, 95 purchase orders, six weeks of priced sales to six customers on account, and two people. Both use the password `stocktake-demo`:

| Email                  | Role  | Can                                                                                  |
| ---------------------- | ----- | ------------------------------------------------------------------------------------ |
| `admin@stocktake.demo` | Admin | manage the catalog, suppliers and people; place, cancel and close orders; void sales |
| `staff@stocktake.demo` | Staff | record stock and sales, take payments, receive deliveries, ask                       |

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

Use `pnpm preview` rather than `wrangler dev` to test the Worker build. It also fills the static-asset cache; without that step the first request hangs.

## Deploy

Deploying needs a Cloudflare account (the free plan is enough) and `pnpm wrangler login`.

```bash
pnpm wrangler d1 create stocktake    # once; put the printed database_id in wrangler.jsonc
pnpm db:migrate:remote
pnpm db:seed:remote                  # optional: the demo dataset
pnpm run deploy                      # not `pnpm deploy`, which is a built-in pnpm command
```

After that, every push to `main` that passes the checks deploys itself. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) applies new D1 migrations, then builds and deploys the Worker. It needs two repository secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and D1: Edit) and `CLOUDFLARE_ACCOUNT_ID`. Changes to Markdown and `docs/` don't run it.

## Project layout

```
drizzle/              migrations: tables, then the rules as triggers
docs/readme/          the images in this README
scripts/              demo seed runner, favicon generator
src/app/
  (marketing)/        the front page, in English and Bangla
  (auth)/             sign-in
  (app)/              the signed-in app: dashboard, products, sales, customers,
                      orders, suppliers, analytics, activity, people, ask
  (app)/@drawer/      the intercepted product drawer
  (print)/            the printable purchase order
  api/                /api/ask (streamed answers) and CSV exports
src/assistant/        the model loop, tools, protocol and daily allowance
src/components/       shared UI: tallies, fields, marks, toasts, palette surfaces
src/db/               schema, D1 client, migration guards
src/domain/           business rules: stock, sales, customers, purchase orders,
                      forecasting, reorder suggestions, analytics, people, imports
src/lib/              formatting, money, Bangla and English, business time, motion
src/server/           data-access layer, session cookie, Server Actions
src/seed/             the deterministic demo dataset and the nightly reset
src/proxy.ts          the optimistic signed-out redirect
worker.mjs            the Worker entry: OpenNext's fetch plus the nightly cron
```

## Where it came from

Stocktake started as **StockMaster**, a PHP and MySQL inventory project for a database course (CSE 252): users and roles, suppliers with reviews, products, stock, and purchase orders. This rebuild keeps that scope and adds the movement ledger with rules enforced by the database, sales with customers and dues, forecasting and reorder suggestions, reconciling analytics, an audit log, a bilingual interface, and an assistant that can only read.

The original is at [SamisDone/StockMaster-Main](https://github.com/SamisDone/StockMaster-Main).
