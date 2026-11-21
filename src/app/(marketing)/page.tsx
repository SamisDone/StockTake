import type { Metadata } from "next";
import Link from "next/link";
import { DemoDoors } from "@/components/demo-doors";
import { Mark } from "@/components/logo";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { REFUSALS } from "@/lib/refusals";

export const metadata: Metadata = {
  title: { absolute: "Stocktake: inventory you can audit" },
  description:
    "Every unit on hand traces back to an entry in an append-only ledger, and the database refuses any write that would break that.",
};

const [headline] = REFUSALS;

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="print-display flex items-center gap-2.5 text-2xl uppercase">
          <Mark size={32} />
          Stocktake
        </Link>
        {/* No prefetch: on Workers the /login route-tree prefetch costs ~100 ms of CPU per
            landing view, and most visitors take the demo doors instead. */}
        <Link
          href="/login"
          prefetch={false}
          className="-mx-1 flex min-h-11 items-center px-1 text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
        >
          Sign in
        </Link>
      </header>

      <main>
        <Hero />
        <Refusals />
        <Ledger />
        <TwoWaysIn />
      </main>

      <footer className="mt-24 border-t-2 border-ink py-8 text-sm text-ink-2">
        <p className="max-w-2xl">
          Stocktake rebuilds{" "}
          <a
            href="https://github.com/SamisDone/StockMaster-Main"
            className="font-semibold text-ink underline decoration-ink-3 hover:decoration-ink"
          >
            StockMaster
          </a>
          , a PHP and MySQL course project, on Next.js, Cloudflare Workers and D1.
        </p>
      </footer>
    </div>
  );
}

/** The claim, the way in, and the proof beside it: a write the database turned down. */
function Hero() {
  return (
    <section className="grid items-start gap-10 pt-8 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pt-16">
      <div>
        <h1 className="print-display text-[clamp(3.5rem,9vw,6rem)] text-balance">Stock you can prove.</h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
          Stocktake records every receipt, sale, return and write-off in a ledger that only grows. The number on hand is
          that ledger&apos;s total, and the database refuses any write that would make the two disagree.
        </p>
        <div className="mt-8 max-w-md">
          <DemoDoors />
        </div>
      </div>

      <figure className="sheet overflow-hidden lg:mt-4" aria-labelledby="slip-caption">
        <div className="border-b-2 border-ink px-6 pt-3 pb-4">
          <p className="field-name">Attempted write</p>
          <pre className="mt-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">{headline.sql}</pre>
        </div>
        <div className="bg-ink px-6 pt-3 pb-5 text-label">
          <p className="text-xs font-semibold text-liner">The database answered</p>
          <p className="mt-2 font-mono text-lg leading-snug font-semibold">{headline.refusal}</p>
        </div>
        <figcaption id="slip-caption" className="px-6 py-3 text-sm text-ink-2">
          {headline.attempt}: refused, and nothing changed. On hand only moves when a movement is recorded.
        </figcaption>
      </figure>
    </section>
  );
}

/** Six writes someone might try, each with the database's own answer. */
function Refusals() {
  return (
    <section aria-labelledby="refusals-title" className="py-12">
      <h2 id="refusals-title" className="print-display text-4xl sm:text-5xl">
        Try to break it.
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
        The rules live in the database, not just in the app, so no bug and no hand-written query can get around them.
        These are its answers, word for word.
      </p>

      <ol className="sheet mt-8 overflow-hidden">
        {REFUSALS.map(({ attempt, sql, refusal }) => (
          <li
            key={attempt}
            className="grid gap-x-8 gap-y-2 border-b border-hairline px-5 py-4 last:border-b-0 sm:px-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)] md:items-baseline"
          >
            <p className="font-semibold">{attempt}</p>
            <code className="font-mono text-xs leading-relaxed break-words text-ink-2">{sql}</code>
            <p className="justify-self-start rounded-mark bg-ink px-2 py-1 font-mono text-xs leading-relaxed font-semibold text-label">
              {refusal}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-2xl text-sm text-ink-2">
        A test runs every statement above against the real migrations and fails if any answer changes, so this list
        can&apos;t drift from the database.
      </p>
    </section>
  );
}

const EXAMPLE_MOVEMENTS = [
  { date: "Oct 2", kind: "Receipt", detail: "PO-0012", quantity: 120 },
  { date: "Oct 5", kind: "Sale", detail: "", quantity: -36 },
  { date: "Oct 11", kind: "Sale", detail: "", quantity: -40 },
  { date: "Oct 14", kind: "Return", detail: "", quantity: 4 },
  { date: "Oct 19", kind: "Write-off", detail: "Crushed carton", quantity: -6 },
  { date: "Oct 28", kind: "Count", detail: "Found 40, expected 42", quantity: -2 },
];

/** Each movement with the running balance after it; the last balance is the number on hand. */
const LEDGER_ROWS = EXAMPLE_MOVEMENTS.map((movement, index) => ({
  ...movement,
  balance: EXAMPLE_MOVEMENTS.slice(0, index + 1).reduce((sum, m) => sum + m.quantity, 0),
}));
const ON_HAND = LEDGER_ROWS[LEDGER_ROWS.length - 1].balance;

/** How a count is made: the ledger, with its running balance, ending in the number on hand. */
function Ledger() {
  return (
    <section
      aria-labelledby="ledger-title"
      className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start"
    >
      <div>
        <h2 id="ledger-title" className="print-display text-4xl sm:text-5xl">
          On hand is a sum.
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">
          Nobody types the number on hand. It is the last line of the product&apos;s ledger, and a mistake is fixed by
          adding a line, never by rewriting one. Ask why a count is what it is, and the answer is right there.
        </p>
      </div>

      <figure className="sheet overflow-hidden">
        <div className="flex items-end justify-between gap-4 border-b-2 border-ink px-5 pt-3 pb-3 sm:px-6">
          <div>
            <p className="field-name">Product</p>
            <p className="font-semibold">
              Packing tape, 48 mm <span className="font-mono text-xs font-normal text-ink-3">PKG-TAPE</span>
            </p>
          </div>
          <p className="field-name">Example</p>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <th scope="col" className="field-name py-2 pl-5 font-semibold sm:pl-6">
                Date
              </th>
              <th scope="col" className="field-name py-2 pl-3 font-semibold">
                Movement
              </th>
              <th scope="col" className="field-name py-2 pl-3 text-right font-semibold">
                Units
              </th>
              <th scope="col" className="field-name py-2 pr-5 pl-3 text-right font-semibold sm:pr-6">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {LEDGER_ROWS.map((row) => (
              <tr key={row.date + row.kind} className="border-b border-hairline">
                <td className="tabular py-2.5 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">{row.date}</td>
                <td className="py-2.5 pl-3">
                  <span className="font-semibold">{row.kind}</span>
                  {row.detail ? <span className="text-ink-2"> · {row.detail}</span> : null}
                </td>
                <td className="tabular py-2.5 pl-3 text-right">
                  {row.quantity > 0 ? `+${row.quantity}` : `−${Math.abs(row.quantity)}`}
                </td>
                <td className="tabular py-2.5 pr-5 pl-3 text-right font-semibold sm:pr-6">{row.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end justify-between gap-4 bg-ink px-5 pt-3 pb-4 text-label sm:px-6">
          <p className="text-sm font-semibold">On hand</p>
          <p className="print-display tabular text-5xl">{ON_HAND}</p>
        </div>
      </figure>
    </section>
  );
}

/** The two seats in the demo, and the door to each. */
function TwoWaysIn() {
  const work = {
    admin: "Runs the catalog and suppliers, reads days of cover and reorder suggestions, and places purchase orders.",
    staff: "Counts shelves, records sales, returns and write-offs, and receives deliveries against placed orders.",
  };

  return (
    <section aria-labelledby="ways-title" className="py-12">
      <h2 id="ways-title" className="print-display text-4xl sm:text-5xl">
        Two ways in.
      </h2>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
        <dl className="grid gap-6 sm:grid-cols-2">
          {DEMO_ROLES.map(({ role, label }) => (
            <div key={role} className="border-t-2 border-ink pt-3">
              <dt className="text-lg font-bold">{label}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{work[role]}</dd>
            </div>
          ))}
        </dl>
        <DemoDoors name="Open the demo as" />
      </div>
      <p className="mt-6 max-w-2xl text-sm text-ink-2">
        The demo is a small distributor with six suppliers and four months of trading. Changes you make are real.
      </p>
    </section>
  );
}
