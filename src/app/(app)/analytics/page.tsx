import { Check, ChevronDown } from "lucide-react";
import type { Metadata, Route } from "next";
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
import { ExportLink } from "@/components/export-link";
import { PageHeader } from "@/components/page-header";
import { FOUR_TALLIES, MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { PageTransition, Reveal } from "@/components/transitions";
import { yearOf } from "@/lib/business-time";
import { type Formats, formats } from "@/lib/format";
import { type Language, localDigits } from "@/lib/i18n";
import { type MoneyFormat, type MoneyPrefs, moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { ANALYTICS_COPY, type AnalyticsCopy } from "./copy";
import { Delivery } from "./delivery";
import { SalesChart } from "./sales-chart";
import { KnownStockChart, KnownStockFigure, StockFigureMorph } from "./known-trail";
import { StockChart } from "./stock-chart";
import { WhereItWent } from "./where-it-went";
import { niceMax } from "@/lib/nice-max";
import { Key, Zone } from "./zone";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";
import { both } from "@/lib/i18n";
import { ProductLink } from "@/components/product-link";
import { FaultText } from "@/components/fault";

export async function generateMetadata(): Promise<Metadata> {
  return { title: ANALYTICS_COPY[await getLanguage()].title };
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <PageTransition>
      <PageHeader title={both(ANALYTICS_COPY, (t) => t.title)} />
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => <ReportPlaceholder t={ANALYTICS_COPY[language]} language={language} />}
          </EitherLanguage>
        }
      >
        <WithLanguage>{(language) => <Report searchParams={searchParams} language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The plain URL is the first period, so only the other one carries a query. */
const periodHref = (days: PeriodDays) => (days === PERIODS[0] ? "/analytics" : `/analytics?period=${days}`) as Route;

/**
 * A period's trading read straight off the ledger. The period lives in the URL, so any
 * view can be shared.
 */
async function Report({
  searchParams,
  language,
}: {
  searchParams: PageProps<"/analytics">["searchParams"];
  language: Language;
}) {
  await getCurrentUser();
  const t = ANALYTICS_COPY[language];
  const f = formats(language);
  const days = readPeriod(one((await searchParams).period));
  // The period ends now.
  await connection();
  const now = new Date();
  const [analytics, money] = await Promise.all([getAnalytics(await getDb(), days, now), getMoneyPrefs()]);
  const m = moneyFormat(money, language);
  const { sales, stock } = analytics;
  const lost = stock.writtenOff.costCents + stock.countShort.costCents - stock.countFound.costCents;
  // Counts can find more than they miss; the note says which way they came out.
  const netShort = stock.countShort.units - stock.countFound.units;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b-2 border-ink">
        <FilterRow legend={t.period}>
          {PERIODS.map((p) => (
            <FilterLink key={p} href={periodHref(p)} current={p === days}>
              {t.lastDays(f.count(p))}
            </FilterLink>
          ))}
        </FilterRow>
        <p className="px-5 pb-3.5 text-sm text-ink-2 sm:px-8">{t.toToday(f.date(analytics.from, now))}</p>
      </div>

      {/* A new period is new content in the same place: the old tears off, the new prints in. */}
      <ViewTransition key={days} enter="print" exit="tear" default="none">
        <div>
          <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
            <Tally name={t.tallies[0]} value={m.whole(sales.valueCents)} language={language}>
              <Note>{t.atList(f.count(sales.units))}</Note>
            </Tally>
            <Tally name={t.tallies[1]} value={m.whole(sales.marginCents)} language={language}>
              <Note>
                {sales.valueCents > 0
                  ? t.ofSales(f.count(Math.round((sales.marginCents / sales.valueCents) * 100)))
                  : t.noSales}
              </Note>
            </Tally>
            <Tally
              name={t.tallies[2]}
              value={m.whole(stock.onHand.costCents)}
              language={language}
              figure={days === PERIODS[0] ? (shown) => <StockFigureMorph>{shown}</StockFigureMorph> : undefined}
            >
              <Note>{t.unitsOnHand(f.count(stock.onHand.units))}</Note>
            </Tally>
            <Tally name={t.tallies[3]} value={m.whole(lost)} language={language}>
              <Note>{t.lostNote(f.count(stock.writtenOff.units), f.count(Math.abs(netShort)), netShort < 0)}</Note>
            </Tally>
          </dl>

          <Statement analytics={analytics} now={now} money={money} m={m} f={f} t={t} />
          {/* Where the stock went, then how the stock that came in arrived: stacked, since
              side by side the shorter one left a blank block beside the taller. */}
          <div className="border-b-2 border-ink">
            <WhereItWent analytics={analytics} m={m} f={f} t={t} className="" />
            <Delivery analytics={analytics} f={f} t={t} className="border-t border-ink" />
          </div>
          <Sales analytics={analytics} now={now} money={money} m={m} f={f} t={t} />
          <Categories analytics={analytics} m={m} f={f} t={t} />
          <div className="grid lg:grid-cols-2">
            <ProductList
              id="best"
              title={t.best}
              note={t.bestNote}
              empty={t.bestEmpty}
              products={analytics.best}
              figure={(p) => ({ value: m.whole(p.salesCents), detail: t.unitsSold(f.count(p.netSold)) })}
            />
            <ProductList
              id="slowest"
              title={t.slowest}
              note={t.slowestNote}
              empty={t.slowestEmpty}
              products={analytics.slowest}
              className="border-ink max-lg:border-t lg:border-l"
              figure={(p) => ({
                value: p.lastsDays === null ? t.noSales : f.days(p.lastsDays),
                detail: t.onHandValue(f.count(p.onHand), m.whole(p.stockCents)),
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

type Line = { name: string; sign: 1 | -1; amount: Amount };

/**
 * The stock reconciliation: opening stock, each kind of movement, and what that adds up
 * to, with each line's bar floating from the running total before it to the one after,
 * all on one scale. The foot checks the sum against the products' own on-hand counts.
 */
function Statement({
  analytics,
  now,
  money,
  m,
  f,
  t,
}: {
  analytics: Analytics;
  now: Date;
  money: MoneyPrefs;
  m: MoneyFormat;
  f: Formats;
  t: AnalyticsCopy;
}) {
  const { stock, from } = analytics;
  const lines: Line[] = [
    { name: t.lines.received, sign: 1, amount: stock.received },
    { name: t.lines.returned, sign: 1, amount: stock.returned },
    { name: t.lines.sold, sign: -1, amount: stock.sold },
    { name: t.lines.writtenOff, sign: -1, amount: stock.writtenOff },
    { name: t.lines.sentBack, sign: -1, amount: stock.sentBack },
    { name: t.lines.found, sign: 1, amount: stock.countFound },
    { name: t.lines.short, sign: -1, amount: stock.countShort },
  ];

  // Running totals in units: where each line's bar starts and ends.
  let running = stock.opening.units;
  const spans = lines.map(({ sign, amount }) => {
    const start = running;
    running += sign * amount.units;
    return [Math.min(start, running), Math.max(start, running)] as const;
  });
  // One round scale for every bar, printed over the bar column.
  const scale = niceMax(Math.max(stock.opening.units, stock.closing.units, ...spans.map(([, end]) => end), 1));
  const agrees = stock.closing.units === stock.onHand.units && stock.closing.costCents === stock.onHand.costCents;

  return (
    <Zone
      id="statement"
      title={t.statement}
      action={<ExportLink href={`/api/export/ledger?period=${analytics.days}`} label={t.ledgerCsv} />}
      note={
        <>
          {t.statementNote(f.date(from, now), m.currency === "BDT")}
          {analytics.startsInside && analytics.ledgerStart ? t.startsInside(f.date(analytics.ledgerStart, now)) : null}
        </>
      }
    >
      {/* The statement over time: stock at cost each day, from the opening line to the closing one. */}
      <div className="mt-5 px-5 sm:px-8">
        <StockChart
          days={analytics.stockByDay}
          openingCents={stock.opening.costCents}
          money={money}
          language={f.language}
          morph={analytics.days === PERIODS[0]}
        />
      </div>
      <table className="mt-8 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ink">
            <Th className="w-[45%] md:w-[26%]">{t.movement}</Th>
            <Th align="right">{t.units}</Th>
            <Th align="right">{t.atCost}</Th>
            <Th className="w-[38%] max-md:hidden">
              <span className="sr-only">{t.runningTotal}</span>
              <span aria-hidden className="tabular relative flex justify-between font-normal">
                <span>{f.count(0)}</span>
                <span className="absolute left-1/2 -translate-x-1/2">{f.count(scale / 2)}</span>
                <span>{t.scaleUnits(f.count(scale))}</span>
              </span>
            </Th>
          </tr>
        </thead>
        <tbody>
          <StatementRow
            name={t.opening(f.date(from, now))}
            units={f.count(stock.opening.units)}
            cost={m.whole(stock.opening.costCents)}
            bar={[0, stock.opening.units]}
            scale={scale}
            total
          />
          {lines.map(({ name, sign, amount }, i) => (
            <StatementRow
              key={name}
              name={name}
              units={f.change(sign * amount.units)}
              cost={m.change(sign * amount.costCents)}
              bar={spans[i]}
              scale={scale}
            />
          ))}
        </tbody>
        <tfoot>
          <StatementRow
            name={t.onHandNow}
            units={f.count(stock.closing.units)}
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
          <span>{t.agrees}</span>
        </p>
      ) : (
        <FaultText role="alert" className="mt-3 px-5 sm:px-8">
          {t.disagrees(f.count(stock.closing.units), f.count(stock.onHand.units))}
        </FaultText>
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

function Sales({
  analytics,
  now,
  money,
  m,
  f,
  t,
}: {
  analytics: Analytics;
  now: Date;
  money: MoneyPrefs;
  m: MoneyFormat;
  f: Formats;
  t: AnalyticsCopy;
}) {
  const { daily } = analytics.sales;
  const any = daily.some((d) => d.units !== 0);
  return (
    <Zone id="sales" title={t.sales} note={t.salesNote}>
      {any ? (
        <>
          <div className="mt-5 px-5 sm:px-8">
            <SalesChart
              money={money}
              language={f.language}
              days={daily.map(({ day, units, valueCents }) => ({ day, units, valueCents }))}
            />
          </div>
          <details className="group mt-6">
            <summary className="press-quiet mx-2 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner sm:mx-5 [&::-webkit-details-marker]:hidden">
              {t.table}
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
                  <Th>{t.day}</Th>
                  <Th align="right">{t.units}</Th>
                  <Th align="right">{t.salesColumn}</Th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d, i) => (
                  <tr key={d.day.getTime()} className="border-b border-hairline last:border-b-0">
                    <th scope="row" className="py-2 pr-4 pl-5 text-sm font-normal sm:pl-8">
                      {i === 0 ? t.todaySoFar : f.day(d.day)}
                      {yearOf(d.day) !== yearOf(now) ? `, ${localDigits(String(yearOf(d.day)), f.language)}` : ""}
                    </th>
                    <td className="tabular py-2 pr-4 text-right text-sm">{f.count(d.units)}</td>
                    <td className="tabular py-2 pr-5 text-right text-sm sm:pr-8">{m.whole(d.valueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="mt-4 px-5 font-semibold sm:px-8">{t.nothingSold(f.count(analytics.days))}</p>
      )}
    </Zone>
  );
}

/** Sales, margin and stock by category. Each sales bar is the category's share, on one scale. */
function Categories({ analytics, m, f, t }: { analytics: Analytics; m: MoneyFormat; f: Formats; t: AnalyticsCopy }) {
  const { categories } = analytics;
  const top = Math.max(...categories.map((c) => c.salesCents), 1);
  const total = categories.reduce((sum, c) => sum + c.salesCents, 0);
  return (
    <Zone id="categories" title={t.categories} note={t.categoriesNote}>
      <div className="mt-4 px-5 sm:px-8">
        <Key
          items={[
            { swatch: <span className="block h-1.5 w-3.5 bg-ink" />, name: t.grossMargin },
            { swatch: <span className="block h-1.5 w-3.5 bg-ink-3/45" />, name: t.costOfSales },
          ]}
        />
      </div>
      <table className="mt-3 w-full border-collapse text-left max-md:block">
        <thead className="max-md:hidden">
          <tr className="border-b border-ink">
            <Th>{t.category}</Th>
            <Th className="w-[28%]">{t.salesColumn}</Th>
            <Th align="right">{t.grossMargin}</Th>
            <Th align="right">{t.stockAtCost}</Th>
            <Th align="right">{t.lasts}</Th>
          </tr>
        </thead>
        <tbody className="max-md:block max-md:border-t max-md:border-ink">
          {categories.map((c) => (
            <tr
              key={c.name}
              className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8"
            >
              <th scope="row" className="py-3 pr-4 font-semibold max-md:col-span-3 max-md:p-0 md:pl-8">
                {c.name === UNCATEGORISED ? <span className="text-ink-2">{t.uncategorised}</span> : c.name}
                <p className="mt-0.5 text-sm font-normal text-ink-3">{t.products(c.products, f.count(c.products))}</p>
              </th>
              <td className="py-3 pr-6 max-md:col-span-3 max-md:p-0">
                <MobileName>{t.salesColumn}</MobileName>
                <p className="text-sm">
                  <span className="font-semibold">{m.whole(c.salesCents)}</span>
                  <span className="text-ink-3">
                    {" "}
                    · {f.count(total > 0 ? Math.round((c.salesCents / total) * 100) : 0)}%
                  </span>
                </p>
                {/* Sales to scale, split: the margin from the baseline, so margins compare
                    exactly, then the cost of what sold. */}
                <div
                  aria-hidden
                  className="mt-2 flex h-1.5 gap-0.5"
                  style={{ width: `${(c.salesCents / top) * 100}%` }}
                >
                  {c.marginCents > 0 ? (
                    <div className="h-full bg-ink" style={{ flex: `${c.marginCents} 1 0` }} />
                  ) : null}
                  {c.salesCents - Math.max(c.marginCents, 0) > 0 ? (
                    <div
                      className="h-full bg-ink-3/45"
                      style={{ flex: `${c.salesCents - Math.max(c.marginCents, 0)} 1 0` }}
                    />
                  ) : null}
                </div>
              </td>
              <td className="tabular py-3 pr-4 text-right max-md:p-0 max-md:text-left">
                <MobileName>{t.grossMargin}</MobileName>
                {m.whole(c.marginCents)}
                <p className="text-sm text-ink-2">
                  {c.salesCents > 0 ? `${f.count(Math.round((c.marginCents / c.salesCents) * 100))}%` : "–"}
                </p>
              </td>
              <td className="tabular py-3 pr-4 text-right max-md:p-0 max-md:text-left">
                <MobileName>{t.stockAtCost}</MobileName>
                {m.whole(c.stockCents)}
              </td>
              <td className="tabular py-3 text-right max-md:p-0 max-md:text-left md:pr-8">
                <MobileName>{t.lasts}</MobileName>
                {c.lastsDays === null ? <span className="text-ink-2">{t.noSales}</span> : f.days(c.lastsDays)}
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
                className="relative flex items-start justify-between gap-4 border-b border-hairline px-5 py-3 transition-colors duration-150 last:border-b-0 row-hit sm:px-8"
              >
                <div className="min-w-0">
                  {/* The name links to the product; its hit area stretches over the whole row. */}
                  <ProductLink
                    id={p.id}
                    className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                  >
                    {p.name}
                  </ProductLink>
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
function ReportPlaceholder({ t, language }: { t: AnalyticsCopy; language: Language }) {
  return (
    <div aria-hidden>
      <div className="border-b-2 border-ink">
        <FilterRowPlaceholder legend={t.period} count={2} />
      </div>
      <TallyPlaceholder
        names={t.tallies}
        className={FOUR_TALLIES}
        notes
        known={{ at: 2, figure: (bar) => <KnownStockFigure language={language} bar={bar} /> }}
      />
      <div className="px-5 pt-6 sm:px-8">
        <p className="text-lg font-bold">{t.statement}</p>
        <div className="mt-1 h-10 max-w-prose bg-liner/70" />
        {/* The stock chart: its readout, then the plot; or the chart itself, opened from the dashboard. */}
        <div className="mt-5">
          <KnownStockChart
            language={language}
            bars={
              <>
                <div className="h-20 w-40 bg-liner/70" />
                <div className="mt-4 h-44 bg-liner/70" />
              </>
            }
          />
        </div>
        <div className="mt-8 space-y-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-7 bg-liner/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
