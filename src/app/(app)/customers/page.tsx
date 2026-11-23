import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listCustomers } from "@/domain/customers";
import { EitherLanguage } from "@/components/either-language";
import { IntentLink } from "@/components/intent-link";
import { PageHeader } from "@/components/page-header";
import { MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import { formats } from "@/lib/format";
import { type Language, both } from "@/lib/i18n";
import { moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { DueMark } from "../sales/marks";
import { CUSTOMERS_COPY, type CustomersCopy } from "./copy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CUSTOMERS_COPY[await getLanguage()].title };
}

export default function CustomersPage() {
  return (
    <PageTransition>
      <PageHeader
        title={both(CUSTOMERS_COPY, (t) => t.title)}
        actions={
          // Anyone can add a customer, so this needs no session and prints with the page.
          <Link
            href="/customers/new"
            transitionTypes={NAV_FORWARD}
            className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold whitespace-nowrap text-label transition-colors duration-150 hover:bg-ink-lift"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
              <Plus aria-hidden size={18} strokeWidth={2.5} />
              <EitherLanguage inline>{(language) => CUSTOMERS_COPY[language].addCustomer}</EitherLanguage>
            </span>
          </Link>
        }
      />
      <Reveal
        fallback={<EitherLanguage>{(language) => <ListPlaceholder t={CUSTOMERS_COPY[language]} />}</EitherLanguage>}
      >
        <WithLanguage>{(language) => <CustomerList language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

/** Who buys, and who owes: those with a due come first, the most owed at the top. */
async function CustomerList({ language }: { language: Language }) {
  const t = CUSTOMERS_COPY[language];
  const f = formats(language);
  await getCurrentUser();
  await connection();
  const now = new Date();
  const [customers, money] = await Promise.all([listCustomers(await getDb()), getMoneyPrefs()]);
  const m = moneyFormat(money, language);
  const owing = customers.filter((c) => c.dueCents > 0);
  const rows = [...owing.sort((a, b) => b.dueCents - a.dueCents), ...customers.filter((c) => c.dueCents <= 0)];

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={customers.length} language={language} />
        <Tally name={t.tallies[1]} value={m.whole(owing.reduce((sum, c) => sum + c.dueCents, 0))} language={language} />
        <Tally name={t.tallies[2]} value={owing.length} language={language} />
      </dl>
      <section aria-labelledby="customers-title" className="pt-2 pb-8">
        <h2 id="customers-title" className="sr-only">
          {t.title}
        </h2>
        {rows.length === 0 ? (
          <div className="px-5 pt-4 sm:px-8">
            <p className="font-semibold">{t.empty}</p>
            <p className="mt-1 max-w-prose text-sm text-ink-2">{t.emptyHelp}</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left max-md:block">
            <thead className="sticky-head max-md:hidden">
              <tr className="border-b border-ink">
                <Th className="w-full">{t.columns.name}</Th>
                <Th>{t.columns.phone}</Th>
                <Th align="right">{t.columns.sales}</Th>
                <Th>{t.columns.lastSale}</Th>
                <Th align="right">{t.columns.due}</Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="relative border-b border-hairline align-top row-hit last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-2 max-md:px-5 max-md:py-3.5 sm:max-md:px-8"
                >
                  <td className="py-3 pr-4 pl-5 max-md:col-span-full max-md:p-0 sm:pl-8">
                    <IntentLink
                      href={`/customers/${c.id}`}
                      transitionTypes={NAV_FORWARD}
                      className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                    >
                      {c.name}
                    </IntentLink>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap max-md:p-0">
                    <MobileName>{t.columns.phone}</MobileName>
                    {c.phone ? (
                      // Above the row's hit area, so calling doesn't open the customer.
                      <a
                        href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                        className="tabular relative z-10 text-sm text-ink-2 underline decoration-ink-3/50 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
                      >
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-ink-3">–</span>
                    )}
                  </td>
                  <td className="tabular py-3 pr-4 whitespace-nowrap max-md:p-0 md:text-right">
                    <MobileName>{t.columns.sales}</MobileName>
                    {f.count(c.saleCount)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-ink-2 max-md:p-0">
                    <MobileName>{t.columns.lastSale}</MobileName>
                    {c.lastSaleAt ? f.date(c.lastSaleAt, now) : t.never}
                  </td>
                  <td className="py-3 pr-5 whitespace-nowrap max-md:col-span-full max-md:p-0 sm:pr-8 md:text-right">
                    {c.dueCents > 0 ? (
                      <>
                        <MobileName>{t.columns.due}</MobileName>
                        <DueMark>{m.money(c.dueCents)}</DueMark>
                      </>
                    ) : c.dueCents < 0 ? (
                      <span className="text-sm text-ink-2">{t.inCredit(m.money(-c.dueCents))}</span>
                    ) : (
                      <span className="text-ink-3">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function ListPlaceholder({ t }: { t: CustomersCopy }) {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={t.tallies} />
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
