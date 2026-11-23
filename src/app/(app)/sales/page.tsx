import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listCustomers } from "@/domain/customers";
import { listSales, salesSummary } from "@/domain/sales";
import { EitherLanguage } from "@/components/either-language";
import { ExportLink } from "@/components/export-link";
import { IntentLink } from "@/components/intent-link";
import { PageHeader } from "@/components/page-header";
import { MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import { addDays, startOfDay } from "@/lib/business-time";
import { type Formats, formats } from "@/lib/format";
import { type Language, both } from "@/lib/i18n";
import { type MoneyFormat, moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { SALES_COPY, type SalesCopy } from "./copy";
import { DueMark, VoidedMark } from "./marks";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SALES_COPY[await getLanguage()].title };
}

export default function SalesPage() {
  return (
    <PageTransition>
      <PageHeader
        title={both(SALES_COPY, (t) => t.title)}
        actions={
          // Anyone can sell, so this needs no session and prints with the page.
          <div className="flex items-center gap-1">
            <ExportLink href="/api/export/sales" />
            <Link
              href="/sales/new"
              transitionTypes={NAV_FORWARD}
              className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold whitespace-nowrap text-label transition-colors duration-150 hover:bg-ink-lift"
            >
              <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
                <Plus aria-hidden size={18} strokeWidth={2.5} />
                <EitherLanguage inline>{(language) => SALES_COPY[language].newSale}</EitherLanguage>
              </span>
            </Link>
          </div>
        }
      />
      <Reveal fallback={<EitherLanguage>{(language) => <ListPlaceholder t={SALES_COPY[language]} />}</EitherLanguage>}>
        <WithLanguage>{(language) => <SalesList language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

/** What's been sold with prices: today, the last four weeks, what customers still owe, then each sale. */
async function SalesList({ language }: { language: Language }) {
  const t = SALES_COPY[language];
  const f = formats(language);
  await getCurrentUser();
  // Today and the period are relative to now.
  await connection();
  const db = await getDb();
  const now = new Date();
  const today = startOfDay(now);
  const [summary, list, customers, money] = await Promise.all([
    salesSummary(db, { today, period: addDays(today, -27) }),
    listSales(db),
    listCustomers(db),
    getMoneyPrefs(),
  ]);
  const m = moneyFormat(money, language);
  const owing = customers.filter((c) => c.dueCents > 0);

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={m.whole(summary.todayCents)} language={language}>
          <p className="mt-1 text-sm text-ink-2">
            {t.salesCount(f.count(summary.todayCount), summary.todayCount === 1)}
          </p>
        </Tally>
        <Tally name={t.tallies[1]} value={m.whole(summary.totalCents)} language={language}>
          <p className="mt-1 text-sm text-ink-2">{t.salesCount(f.count(summary.count), summary.count === 1)}</p>
        </Tally>
        <Tally name={t.tallies[2]} value={m.whole(owing.reduce((sum, c) => sum + c.dueCents, 0))} language={language}>
          <p className="mt-1 text-sm text-ink-2">{t.owingCount(f.count(owing.length), owing.length === 1)}</p>
        </Tally>
      </dl>

      <section aria-labelledby="sales-title" className="pt-5 pb-8">
        <h2 id="sales-title" className="px-5 text-lg font-bold sm:px-8">
          {t.listTitle}
        </h2>
        <p className="mt-1 max-w-prose px-5 text-sm text-ink-2 sm:px-8">{t.listNote}</p>
        {list.length === 0 ? (
          <div className="px-5 pt-5 sm:px-8">
            <p className="font-semibold">{t.empty}</p>
            <p className="mt-1 max-w-prose text-sm text-ink-2">{t.emptyHelp}</p>
          </div>
        ) : (
          <table className="mt-3 w-full border-collapse text-left max-md:block">
            <thead className="sticky-head max-md:hidden">
              <tr className="border-b border-ink">
                <Th>{t.columns.sale}</Th>
                <Th className="w-full">{t.columns.customer}</Th>
                <Th>{t.columns.date}</Th>
                <Th align="right">{t.columns.lines}</Th>
                <Th align="right">{t.columns.total}</Th>
                <Th align="right">{t.columns.due}</Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {list.map((sale) => (
                <SaleRow key={sale.id} sale={sale} now={now} f={f} m={m} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

type Sale = Awaited<ReturnType<typeof listSales>>[number];

/** One sale: its number opens it, and the whole row is the hit area. */
function SaleRow({ sale, now, f, m, t }: { sale: Sale; now: Date; f: Formats; m: MoneyFormat; t: SalesCopy }) {
  return (
    <tr className="relative border-b border-hairline align-top row-hit last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-2 max-md:px-5 max-md:py-3.5 sm:max-md:px-8">
      <td className="py-3 pr-4 pl-5 whitespace-nowrap max-md:p-0 sm:pl-8">
        <IntentLink
          href={`/sales/${sale.id}`}
          transitionTypes={NAV_FORWARD}
          className="font-mono text-xs font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
        >
          {sale.number}
        </IntentLink>
      </td>
      <td className="py-3 pr-4 max-md:col-span-2 max-md:p-0 max-md:text-right">
        <span className={sale.customerName ? "font-semibold" : "text-ink-2"}>{sale.customerName ?? t.walkIn}</span>
        {sale.voided ? (
          <span className="ml-2">
            <VoidedMark label={t.voided} />
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap text-ink-2 max-md:p-0">
        <MobileName>{t.columns.date}</MobileName>
        {f.date(sale.soldAt, now)}
      </td>
      <td className="tabular py-3 pr-4 whitespace-nowrap max-md:p-0 md:text-right">
        <MobileName>{t.columns.lines}</MobileName>
        {f.count(sale.lineCount)}
      </td>
      <td
        className={`tabular py-3 pr-4 whitespace-nowrap max-md:p-0 md:text-right ${sale.voided ? "text-ink-3 line-through" : "font-semibold"}`}
      >
        <MobileName>{t.columns.total}</MobileName>
        {m.money(sale.totalCents)}
      </td>
      <td
        className={`py-3 pr-5 whitespace-nowrap max-md:col-span-full max-md:p-0 sm:pr-8 md:text-right ${sale.dueCents > 0 ? "" : "max-md:hidden"}`}
      >
        {sale.dueCents > 0 ? (
          <>
            <MobileName>{t.columns.due}</MobileName>
            <DueMark>{m.money(sale.dueCents)}</DueMark>
          </>
        ) : (
          <span className="text-ink-3 max-md:hidden">–</span>
        )}
      </td>
    </tr>
  );
}

/** The same page, unprinted: the tallies and the rows hold their space. */
function ListPlaceholder({ t }: { t: SalesCopy }) {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={t.tallies} />
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        <div className="h-5 w-40 bg-liner" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
