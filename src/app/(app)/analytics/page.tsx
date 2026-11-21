import { Check, ChevronDown } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ViewTransition, type ReactNode } from "react";
import { getDb } from "@/db/client";
import {
  type Amount,
  type Analytics,
  PERIODS,
  type PeriodDays,
  type ProductFigures,
  UNCATEGORISED,
  getAnalytics,
  readPeriod,
} from "@/domain/analytics";
import { FilterLink, FilterRow, FilterRowPlaceholder } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { FOUR_TALLIES, MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { formatChange, formatCount, formatDate, formatDay, formatDays } from "@/lib/format";
import { type MoneyFormat, type MoneyPrefs, moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getMoneyPrefs } from "@/server/preferences";
import { SalesChart } from "./sales-chart";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <PageTransition>
      <PageHeader title="Analytics" />
      <Reveal fallback={<ReportPlaceholder />}>
        <Report searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The plain URL is the first period, so only the other one carries a query. */
const periodHref = (days: PeriodDays) => (days === PERIODS[0] ? "/analytics" : `/analytics?period=${days}`) as Route;

const TALLY_NAMES = ["Sales", "Gross margin", "Stock at cost", "Lost stock"];

/**
 * A period's trading read straight off the ledger. The period lives in the URL, so any
 * view can be shared.
 */
async function Report({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  await getCurrentUser();
  const days = readPeriod(one((await searchParams).period));
  // The period ends now.
  await connection();
  const now = new Date();
  const [analytics, money] = await Promise.all([getAnalytics(await getDb(), days, now), getMoneyPrefs()]);
  const m = moneyFormat(money);
  const { sales, stock } = analytics;
  const lost = stock.writtenOff.costCents + stock.countShort.costCents - stock.countFound.costCents;
  // Counts can find more than they miss; the note says which way they came out.
  const netShort = stock.countShort.units - stock.countFound.units;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b-2 border-ink">
        <FilterRow legend="Period">
          {PERIODS.map((p) => (
            <FilterLink key={p} href={periodHref(p)} current={p === days}>
              Last {p} days
            </FilterLink>
          ))}
        </FilterRow>
        <p className="px-5 pb-3.5 text-sm text-ink-2 sm:px-8">
          {formatDate(analytics.from, now)} to today · days are UTC
        </p>
      </div>

      {/* A new period is new content in the same place: the old tears off, the new prints in. */}
      <ViewTransition key={days} enter="print" exit="tear" default="none">
        <div>
          <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
            <Tally name="Sales" value={m.whole(sales.valueCents)}>
              <Note>{formatCount(sales.units)} units at list price</Note>
            </Tally>
            <Tally name="Gross margin" value={m.whole(sales.marginCents)}>
              <Note>
                {sales.valueCents > 0
                  ? `${Math.round((sales.marginCents / sales.valueCents) * 100)}% of sales`
                  : "No sales"}
              </Note>
            </Tally>
            <Tally name="Stock at cost" value={m.whole(stock.onHand.costCents)}>
              <Note>{formatCount(stock.onHand.units)} units on hand</Note>
            </Tally>
            <Tally name="Lost stock" value={m.whole(lost)}>
              <Note>
                {formatCount(stock.writtenOff.units)} written off, {formatCount(Math.abs(netShort))} net{" "}
                {netShort < 0 ? "over" : "short"} in counts
              </Note>
            </Tally>
          </dl>

          <Statement analytics={analytics} now={now} m={m} />
          <Sales analytics={analytics} now={now} money={money} m={m} />
          <Categories analytics={analytics} m={m} />
          <div className="grid lg:grid-cols-2">
            <ProductList
              id="best"
              title="Best sellers"
              note="By sales at list price, net of returns."
              empty="Nothing sold in this period."
              products={analytics.best}
              figure={(p) => ({ value: m.whole(p.salesCents), detail: `${formatCount(p.netSold)} units` })}
            />
            <ProductList
              id="slowest"
              title="Slowest to sell"
              note="Active products whose stock lasts longest at this period's sales."
              empty="No active product has stock."
              products={analytics.slowest}
              className="border-ink max-lg:border-t lg:border-l"
              figure={(p) => ({
                value: p.lastsDays === null ? "No sales" : formatDays(p.lastsDays),
                detail: `${formatCount(p.onHand)} on hand · ${m.whole(p.stockCents)}`,
              })}
            />
          </div>
        </div>
      </ViewTransition>
    </>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-ink-2">{children}</p>;
}

/** A zone of the report: its heading, a line on how to read it, then its content. */
function Zone({
  id,
  title,
  note,
  className = "border-b-2 border-ink",
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={`pt-6 pb-8 ${className}`}>
      <div className="px-5 sm:px-8">
        <h2 id={`${id}-title`} className="text-lg font-bold">
          {title}
        </h2>
        {note ? <p className="mt-1 max-w-prose text-sm text-ink-2">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

type Line = { name: string; sign: 1 | -1; amount: Amount };

/**
 * The stock reconciliation: opening stock, each kind of movement, and what that adds up
 * to, with each line's bar floating from the running total before it to the one after,
 * all on one scale. The foot checks the sum against the products' own on-hand counts.
 */
function Statement({ analytics, now, m }: { analytics: Analytics; now: Date; m: MoneyFormat }) {
  const { stock, from } = analytics;
  const lines: Line[] = [
    { name: "Received", sign: 1, amount: stock.received },
    { name: "Returned", sign: 1, amount: stock.returned },
    { name: "Sold", sign: -1, amount: stock.sold },
    { name: "Written off", sign: -1, amount: stock.writtenOff },
    { name: "Found in counts", sign: 1, amount: stock.countFound },
    { name: "Short in counts", sign: -1, amount: stock.countShort },
  ];

  // Running totals in units: where each line's bar starts and ends.
  let running = stock.opening.units;
  const spans = lines.map(({ sign, amount }) => {
    const start = running;
    running += sign * amount.units;
    return [Math.min(start, running), Math.max(start, running)] as const;
  });
  const scale = Math.max(stock.opening.units, stock.closing.units, ...spans.map(([, end]) => end), 1);
  const agrees = stock.closing.units === stock.onHand.units && stock.closing.costCents === stock.onHand.costCents;

  return (
    <Zone
      id="statement"
      title="Stock, from the ledger"
      note={
        <>
          What was on the shelves on {formatDate(from, now)}, plus every movement the ledger recorded since, is
          what&apos;s on hand now. Money is at today&apos;s unit costs
          {m.currency === "BDT" ? " and today's taka rate" : ""}.
          {analytics.startsInside && analytics.ledgerStart ? (
            <>
              {" "}
              The ledger starts on {formatDate(analytics.ledgerStart, now)}, inside this period, so it opens at zero.
            </>
          ) : null}
        </>
      }
    >
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ink">
            <Th className="w-[45%] md:w-[26%]">Movement</Th>
            <Th align="right">Units</Th>
            <Th align="right">At cost</Th>
            <Th className="w-[38%] max-md:hidden">
              <span className="sr-only">Running total</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          <StatementRow
            name={`Opening stock, ${formatDate(from, now)}`}
            units={formatCount(stock.opening.units)}
            cost={m.whole(stock.opening.costCents)}
            bar={[0, stock.opening.units]}
            scale={scale}
            total
          />
          {lines.map(({ name, sign, amount }, i) => (
            <StatementRow
              key={name}
              name={name}
              units={formatChange(sign * amount.units)}
              cost={m.change(sign * amount.costCents)}
              bar={spans[i]}
              scale={scale}
            />
          ))}
        </tbody>
        <tfoot>
          <StatementRow
            name="On hand now"
            units={formatCount(stock.closing.units)}
            cost={m.whole(stock.closing.costCents)}
            bar={[0, stock.closing.units]}
            scale={scale}
            closing
          />
        </tfoot>
      </table>
      {agrees ? (
        <p className="mt-3 flex items-start gap-2 px-5 text-sm text-ink-2 sm:px-8">
          <Check aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink" />
          <span>Matches the on-hand count of every product, which the database keeps equal to the ledger.</span>
        </p>
      ) : (
        <p role="alert" className="mt-3 bg-stock px-5 py-3 text-sm font-medium text-ink sm:px-8">
          The ledger adds up to {formatCount(stock.closing.units)} units, but the products&apos; on-hand counts add up
          to {formatCount(stock.onHand.units)}.
        </p>
      )}
    </Zone>
  );
}

function StatementRow({
  name,
  units,
  cost,
  bar,
  scale,
  total = false,
  closing = false,
}: {
  name: string;
  units: string;
  cost: string;
  bar: readonly [number, number];
  scale: number;
  total?: boolean;
  closing?: boolean;
}) {
  // A line that moved nothing draws nothing; one that moved a little still shows a sliver.
  const track = (
    <div aria-hidden className="relative h-2">
      {bar[1] > bar[0] ? (
        <div
          className={`absolute inset-y-0 min-w-0.5 rounded-mark ${closing ? "bg-label" : total ? "bg-ink" : "bg-ink-3"}`}
          style={{ left: `${(bar[0] / scale) * 100}%`, width: `${((bar[1] - bar[0]) / scale) * 100}%` }}
        />
      ) : null}
    </div>
  );
  return (
    <tr className={closing ? "bg-ink text-label" : "border-b border-hairline last:border-b-0"}>
      <th scope="row" className={`py-3 pr-4 pl-5 align-top sm:pl-8 ${total || closing ? "font-bold" : "font-normal"}`}>
        {name}
        {/* On a phone the bar runs under the name, where there's room for it. */}
        <div className="mt-2 md:hidden">{track}</div>
      </th>
      <td
        className={`tabular py-3 pr-4 text-right align-top ${closing ? "print-display text-2xl" : total ? "font-bold" : ""}`}
      >
        {units}
      </td>
      <td
        className={`tabular py-3 pr-5 text-right align-top sm:pr-8 md:pr-4 ${closing ? "print-display text-2xl" : total ? "font-bold" : "text-ink-2"}`}
      >
        {cost}
      </td>
      <td className="py-3 pr-8 align-middle max-md:hidden">{track}</td>
    </tr>
  );
}

function Sales({ analytics, now, money, m }: { analytics: Analytics; now: Date; money: MoneyPrefs; m: MoneyFormat }) {
  const { daily } = analytics.sales;
  const any = daily.some((d) => d.units !== 0);
  return (
    <Zone
      id="sales"
      title="Sales by day"
      note="Units sold less returns, at today's list prices: the ledger records units, not the price a sale was made at."
    >
      {any ? (
        <>
          <div className="mt-5 px-5 sm:px-8">
            <SalesChart money={money} days={daily.map(({ day, units, valueCents }) => ({ day, units, valueCents }))} />
          </div>
          <details className="group mt-6">
            <summary className="press-quiet mx-2 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner sm:mx-5 [&::-webkit-details-marker]:hidden">
              Every day as a table
              <ChevronDown
                aria-hidden
                size={18}
                strokeWidth={2.25}
                className="text-ink-2 transition-transform duration-150 ease-out group-open:rotate-180"
              />
            </summary>
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink">
                  <Th>Day</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Sales</Th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d, i) => (
                  <tr key={d.day.getTime()} className="border-b border-hairline last:border-b-0">
                    <th scope="row" className="py-2 pr-4 pl-5 text-sm font-normal sm:pl-8">
                      {i === 0 ? "Today so far" : formatDay(d.day)}
                      {d.day.getUTCFullYear() !== now.getUTCFullYear() ? `, ${d.day.getUTCFullYear()}` : ""}
                    </th>
                    <td className="tabular py-2 pr-4 text-right text-sm">{formatCount(d.units)}</td>
                    <td className="tabular py-2 pr-5 text-right text-sm sm:pr-8">{m.whole(d.valueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="mt-4 px-5 font-semibold sm:px-8">Nothing sold in the last {analytics.days} days.</p>
      )}
    </Zone>
  );
}

/** Sales, margin and stock by category. Each sales bar is the category's share, on one scale. */
function Categories({ analytics, m }: { analytics: Analytics; m: MoneyFormat }) {
  const { categories } = analytics;
  const top = Math.max(...categories.map((c) => c.salesCents), 1);
  const total = categories.reduce((sum, c) => sum + c.salesCents, 0);
  return (
    <Zone
      id="categories"
      title="By category"
      note="Lasts is how long a category's stock would last at this period's cost of sales."
    >
      <table className="mt-4 w-full border-collapse text-left max-md:block">
        <thead className="max-md:hidden">
          <tr className="border-b border-ink">
            <Th>Category</Th>
            <Th className="w-[28%]">Sales</Th>
            <Th align="right">Gross margin</Th>
            <Th align="right">Stock at cost</Th>
            <Th align="right">Lasts</Th>
          </tr>
        </thead>
        <tbody className="max-md:block max-md:border-t max-md:border-ink">
          {categories.map((c) => (
            <tr
              key={c.name}
              className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8"
            >
              <th scope="row" className="py-3 pr-4 font-semibold max-md:col-span-3 max-md:p-0 md:pl-8">
                <span className={c.name === UNCATEGORISED ? "text-ink-2" : undefined}>{c.name}</span>
                <p className="mt-0.5 text-sm font-normal text-ink-3">
                  {formatCount(c.products)} {c.products === 1 ? "product" : "products"}
                </p>
              </th>
              <td className="py-3 pr-6 max-md:col-span-3 max-md:p-0">
                <MobileName>Sales</MobileName>
                <p className="text-sm">
                  <span className="font-semibold">{m.whole(c.salesCents)}</span>
                  <span className="text-ink-3"> · {total > 0 ? Math.round((c.salesCents / total) * 100) : 0}%</span>
                </p>
                <div aria-hidden className="mt-2 h-1.5 bg-liner">
                  <div className="h-full bg-ink" style={{ width: `${(c.salesCents / top) * 100}%` }} />
                </div>
              </td>
              <td className="tabular py-3 pr-4 text-right max-md:p-0 max-md:text-left">
                <MobileName>Gross margin</MobileName>
                {m.whole(c.marginCents)}
                <p className="text-sm text-ink-2">
                  {c.salesCents > 0 ? `${Math.round((c.marginCents / c.salesCents) * 100)}%` : "–"}
                </p>
              </td>
              <td className="tabular py-3 pr-4 text-right max-md:p-0 max-md:text-left">
                <MobileName>Stock at cost</MobileName>
                {m.whole(c.stockCents)}
              </td>
              <td className="tabular py-3 text-right max-md:p-0 max-md:text-left md:pr-8">
                <MobileName>Lasts</MobileName>
                {c.lastsDays === null ? <span className="text-ink-2">No sales</span> : formatDays(c.lastsDays)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Zone>
  );
}

function ProductList({
  id,
  title,
  note,
  empty,
  products,
  figure,
  className = "",
}: {
  id: string;
  title: string;
  note: string;
  empty: string;
  products: ProductFigures[];
  figure: (p: ProductFigures) => { value: string; detail: string };
  className?: string;
}) {
  return (
    <Zone id={id} title={title} note={note} className={className}>
      {products.length === 0 ? (
        <p className="mt-4 px-5 font-semibold sm:px-8">{empty}</p>
      ) : (
        <ol className="mt-4 border-t border-ink">
          {products.map((p) => {
            const { value, detail } = figure(p);
            return (
              <li
                key={p.id}
                className="relative flex items-start justify-between gap-4 border-b border-hairline px-5 py-3 transition-colors duration-150 last:border-b-0 hover:bg-liner/60 sm:px-8"
              >
                <div className="min-w-0">
                  {/* The name links to the product; its hit area stretches over the whole row. */}
                  <Link
                    href={`/products/${p.id}`}
                    prefetch={false}
                    transitionTypes={NAV_FORWARD}
                    className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-ink-3">{p.sku}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-semibold">{value}</p>
                  <p className="tabular text-sm text-ink-2">{detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Zone>
  );
}

/** The same report, unprinted: the period row, tallies and statement hold their space. */
function ReportPlaceholder() {
  return (
    <div aria-hidden>
      <div className="border-b-2 border-ink">
        <FilterRowPlaceholder legend="Period" count={2} />
      </div>
      <TallyPlaceholder names={TALLY_NAMES} className={FOUR_TALLIES} notes />
      <div className="px-5 pt-6 sm:px-8">
        <p className="text-lg font-bold">Stock, from the ledger</p>
        <div className="mt-2 h-10 max-w-prose bg-liner/70" />
        <div className="mt-6 space-y-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-7 bg-liner/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
