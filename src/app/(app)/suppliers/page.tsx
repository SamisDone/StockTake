import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { getStockForecasts } from "@/domain/forecast";
import { deliveryRecord, listOrders } from "@/domain/purchase-orders";
import { listSuppliers } from "@/domain/suppliers";
import { PageHeader } from "@/components/page-header";
import { Stars, formatRating } from "@/components/stars";
import { MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyFormat, moneyFormat } from "@/lib/money";
import { getCurrentUser, getSessionUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { SUPPLIERS_COPY, type SuppliersCopy } from "./copy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SUPPLIERS_COPY[await getLanguage()].title };
}

export default async function SuppliersPage() {
  const language = await getLanguage();
  const t = SUPPLIERS_COPY[language];
  return (
    <PageTransition>
      <PageHeader
        title={t.title}
        actions={
          // The header keeps the button's height whoever is signed in, so it never grows
          // when the session arrives.
          <div className="flex h-12 items-end">
            <Suspense>
              <AddSupplier t={t} />
            </Suspense>
          </div>
        }
      />
      <Reveal fallback={<ListPlaceholder t={t} />}>
        <SupplierList language={language} />
      </Reveal>
    </PageTransition>
  );
}

async function AddSupplier({ t }: { t: SuppliersCopy }) {
  const user = await getSessionUser();
  if (user?.role !== "admin") return null;
  return (
    <Link
      href="/suppliers/new"
      prefetch={false}
      transitionTypes={NAV_FORWARD}
      className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
    >
      <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
        <Plus aria-hidden size={18} strokeWidth={2.5} />
        {t.addSupplier}
      </span>
    </Link>
  );
}

type Row = {
  id: number;
  name: string;
  contact: string;
  leadTimeDays: number;
  products: number;
  /** Its products the forecast flags: out of stock or due a reorder. */
  low: number;
  onOrderCents: number;
  received: number;
  onTime: number;
  averageRating: number | null;
  reviewCount: number;
  archivedAt: Date | null;
};

/**
 * Who stock comes from, and how each one is doing: what of theirs is running low,
 * what's on order with them, whether they deliver on time, and what people rate them.
 */
async function SupplierList({ language }: { language: Language }) {
  const t = SUPPLIERS_COPY[language];
  const f = formats(language);
  await getCurrentUser();
  // Running low and on order are relative to now.
  await connection();
  const db = await getDb();
  const now = new Date();
  const [suppliers, forecasts, orders, money] = await Promise.all([
    listSuppliers(db, { includeArchived: true }),
    getStockForecasts(db, now),
    listOrders(db),
    getMoneyPrefs(),
  ]);
  const m = moneyFormat(money, language);

  const rows: Row[] = suppliers.map((s) => {
    const theirs = orders.filter((o) => o.supplierId === s.id);
    return {
      id: s.id,
      name: s.name,
      contact: [s.email, s.phone].filter(Boolean).join(" · "),
      leadTimeDays: s.leadTimeDays,
      products: s.productCount,
      low: forecasts.filter((f) => f.supplierId === s.id && f.status !== "ok").length,
      onOrderCents: theirs.filter((o) => o.status === "ordered").reduce((sum, o) => sum + o.totalCents, 0),
      ...deliveryRecord(theirs),
      averageRating: s.averageRating,
      reviewCount: s.reviewCount,
      archivedAt: s.archivedAt,
    };
  });
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);
  const record = deliveryRecord(orders.filter((o) => active.some((r) => r.id === o.supplierId)));

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={active.length} language={language} />
        <Tally
          name={t.tallies[1]}
          value={m.whole(active.reduce((sum, r) => sum + r.onOrderCents, 0))}
          language={language}
        />
        <Tally
          name={t.tallies[2]}
          language={language}
          value={record.received === 0 ? "–" : `${f.count(Math.round((record.onTime / record.received) * 100))}%`}
        >
          <p className="mt-1 text-sm text-ink-2">{t.receivedOf(f.count(record.onTime), f.count(record.received))}</p>
        </Tally>
      </dl>

      <section aria-labelledby="suppliers-title" className="pt-2 pb-8">
        <h2 id="suppliers-title" className="sr-only">
          {t.title}
        </h2>
        {active.length === 0 ? (
          <p className="px-5 pt-4 font-semibold sm:px-8">{t.noSuppliers}</p>
        ) : (
          <SupplierTable m={m} f={f} t={t} rows={active} caption={t.caption} />
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-title" className="border-t-2 border-ink pt-5 pb-8">
          <h2 id="archived-title" className="px-5 text-lg font-bold sm:px-8">
            {t.archived}
          </h2>
          <p className="mt-1 max-w-prose px-5 text-sm text-ink-2 sm:px-8">{t.archivedHelp}</p>
          <ul className="mt-3">
            {archived.map((r) => (
              <li
                key={r.id}
                className="relative border-b border-hairline px-5 py-3 last:border-b-0 hover:bg-liner/60 sm:px-8"
              >
                <Link
                  href={`/suppliers/${r.id}`}
                  prefetch={false}
                  transitionTypes={NAV_FORWARD}
                  className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                >
                  {r.name}
                </Link>
                <span className="text-sm text-ink-2"> · {t.archivedOn(f.date(r.archivedAt!, now))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function SupplierTable({
  rows,
  caption,
  m,
  f,
  t,
}: {
  rows: Row[];
  caption: string;
  m: MoneyFormat;
  f: Formats;
  t: SuppliersCopy;
}) {
  const c = t.columns;
  return (
    <table className="w-full border-collapse text-left max-lg:block">
      <caption className="sr-only">{caption}</caption>
      <thead className="max-lg:hidden">
        <tr className="border-b border-ink">
          <Th className="w-full">{c.supplier}</Th>
          <Th align="right">{c.leadTime}</Th>
          <Th align="right">{c.products}</Th>
          <Th align="right">{c.onOrder}</Th>
          <Th align="right">{c.onTime}</Th>
          <Th>{c.rating}</Th>
        </tr>
      </thead>
      <tbody className="max-lg:block">
        {rows.map((row) => (
          <SupplierRow key={row.id} row={row} m={m} f={f} t={t} />
        ))}
      </tbody>
    </table>
  );
}

/** One supplier: the name opens it, and the whole row is the hit area. */
function SupplierRow({ row, m, f, t }: { row: Row; m: MoneyFormat; f: Formats; t: SuppliersCopy }) {
  const c = t.columns;
  return (
    <tr className="relative border-b border-hairline align-top transition-colors duration-150 last:border-b-0 hover:bg-liner/60 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-5 max-lg:gap-y-3 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-4 sm:max-lg:px-8">
      <td className="py-3 pr-4 max-lg:col-span-full max-lg:p-0 lg:pl-8">
        <Link
          href={`/suppliers/${row.id}`}
          prefetch={false}
          transitionTypes={NAV_FORWARD}
          className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
        >
          {row.name}
        </Link>
        {row.contact ? <p className="mt-0.5 text-sm text-ink-3">{row.contact}</p> : null}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap max-lg:p-0 lg:text-right">
        <MobileName>{c.leadTime}</MobileName>
        {t.days(row.leadTimeDays, f.count(row.leadTimeDays))}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap max-lg:p-0 lg:text-right">
        <MobileName>{c.products}</MobileName>
        <span className="inline-flex items-baseline gap-2">
          {row.low > 0 ? (
            <span className="rounded-mark bg-stock px-1.5 py-px text-xs font-bold">{t.low(f.count(row.low))}</span>
          ) : null}
          {f.count(row.products)}
        </span>
      </td>
      <td className="py-3 pr-4 whitespace-nowrap max-lg:p-0 lg:text-right">
        <MobileName>{c.onOrder}</MobileName>
        {row.onOrderCents > 0 ? m.whole(row.onOrderCents) : <span className="text-ink-2">–</span>}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap max-lg:p-0 lg:text-right">
        <MobileName>{c.onTime}</MobileName>
        {row.received > 0 ? (
          <>
            {f.count(row.onTime)} <span className="text-ink-2">{t.of(f.count(row.received))}</span>
          </>
        ) : (
          <span className="text-ink-2">–</span>
        )}
      </td>
      <td className="py-3 whitespace-nowrap max-lg:col-span-full max-lg:p-0 sm:max-lg:col-span-4 lg:pr-8">
        <MobileName>{c.rating}</MobileName>
        {row.averageRating === null ? (
          <span className="text-sm text-ink-2">{t.noReviews}</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Stars rating={row.averageRating} language={f.language} />
            <span className="text-sm">
              <span className="font-semibold">{formatRating(row.averageRating, f.language)}</span>{" "}
              <span className="text-ink-2">({f.count(row.reviewCount)})</span>
            </span>
          </span>
        )}
      </td>
    </tr>
  );
}

/** The same label, unprinted: the tallies and the rows hold their space. */
function ListPlaceholder({ t }: { t: SuppliersCopy }) {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={t.tallies} />
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
