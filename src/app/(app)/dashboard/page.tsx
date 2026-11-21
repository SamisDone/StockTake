import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import Link from "next/link";
import { type StockForecast, getStockForecasts } from "@/domain/forecast";
import { poNumber } from "@/domain/purchase-orders";
import { draftsFor } from "@/domain/reorder";
import { type Formats, formats } from "@/lib/format";
import type { Copy, Language } from "@/lib/i18n";
import { type MoneyFormat, moneyFormat } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { CoverBar, MobileName, StatusMark, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";
import { both } from "@/lib/i18n";
import { ProductLink } from "@/components/product-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await getLanguage()].title };
}

export default function DashboardPage() {
  return (
    <PageTransition>
      <PageHeader title={both(COPY, (t) => t.title)} />
      <Reveal fallback={<EitherLanguage>{(language) => <AttentionPlaceholder t={COPY[language]} />}</EitherLanguage>}>
        <WithLanguage>{(language) => <Attention language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

type Forecast = StockForecast;

async function Attention({ language }: { language: Language }) {
  const t = COPY[language];
  const f = formats(language);
  await getCurrentUser();
  // Forecasts are relative to now, so they belong to the request, never to a prerender.
  await connection();
  const db = await getDb();
  const forecasts = await getStockForecasts(db);
  const m = moneyFormat(await getMoneyPrefs(), language);
  const attention = forecasts.filter((f) => f.status !== "ok");
  const out = attention.filter((f) => f.status === "out").length;
  // A product already on a draft order is in hand: it isn't suggested again, or costed.
  const drafts = await draftsFor(
    db,
    attention.map((f) => f.id),
  );
  const reorderCost = attention
    .filter((f) => !drafts.has(f.id))
    .reduce((sum, f) => sum + f.suggestedQuantity * f.unitCostCents, 0);

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={out} language={language} />
        <Tally name={t.tallies[1]} value={attention.length - out} language={language} />
        <Tally name={t.tallies[2]} value={m.whole(reorderCost)} language={language} />
      </dl>

      <section aria-labelledby="attention-title" className="pt-6 pb-8">
        <h2 id="attention-title" className="px-5 text-lg font-bold sm:px-8">
          {t.attention}
        </h2>
        {attention.length === 0 ? (
          <p className="mt-2 max-w-prose px-5 text-ink-2 sm:px-8">{t.nothing}</p>
        ) : (
          <>
            <p className="mt-1 max-w-prose px-5 text-sm text-ink-2 sm:px-8">
              {t.coverHelp}{" "}
              <Link
                href="/orders"
                transitionTypes={NAV_FORWARD}
                className="font-semibold text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              >
                {t.draft}
              </Link>
            </p>
            {/* A table from md up, running to the sheet's edges so a row's hover fill does too;
                below md each row stacks into a small label of named fields. */}
            <table className="mt-4 w-full border-collapse text-left max-md:block">
              <thead className="max-md:hidden">
                <tr className="border-b border-ink">
                  <Th>{t.product}</Th>
                  <Th align="right">{t.onHand}</Th>
                  <Th align="right">{t.onOrder}</Th>
                  <Th className="w-[30%]">{t.cover}</Th>
                  <Th align="right">{t.suggested}</Th>
                </tr>
              </thead>
              <tbody className="max-md:block max-md:border-t max-md:border-ink">
                {attention.map((row) => (
                  <AttentionRow key={row.id} forecast={row} draft={drafts.get(row.id)} m={m} f={f} t={t} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}

function AttentionRow({
  forecast: row,
  draft,
  m,
  f,
  t,
}: {
  forecast: Forecast;
  /** The draft order this product is already on, if any. */
  draft: { orderId: number; quantity: number } | undefined;
  m: MoneyFormat;
  f: Formats;
  t: DashboardCopy;
}) {
  const suggestedCost = row.suggestedQuantity * row.unitCostCents;

  return (
    <tr className="relative border-b border-hairline align-top row-hit last:border-b-0 max-md:grid max-md:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0 md:pl-8">
        <div className="flex items-baseline gap-2">
          <StatusMark status={row.status} language={f.language} />
          {/* The name links to the product; its hit area stretches over the whole row. */}
          <ProductLink
            id={row.id}
            className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {row.name}
          </ProductLink>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          <span className="font-mono text-xs">{row.sku}</span>
          {row.supplierName ? <> · {row.supplierName}</> : null}
        </p>
      </td>
      <td className="tabular py-3 pr-4 text-right text-lg font-semibold max-md:p-0 max-md:text-left">
        <MobileName>{t.onHand}</MobileName>
        {f.count(row.onHand)}
      </td>
      <td className="tabular py-3 pr-4 text-right text-ink-2 max-md:hidden">
        {row.onOrder > 0 ? f.count(row.onOrder) : "–"}
      </td>
      <td className="py-3 pr-6 max-md:p-0">
        <MobileName>{t.cover}</MobileName>
        <CoverBar daysOfCover={row.daysOfCover} leadTimeDays={row.leadTimeDays} language={f.language} />
      </td>
      <td className="tabular py-3 text-right max-md:p-0 max-md:text-left md:pr-8">
        <MobileName>{t.order}</MobileName>
        {draft ? (
          // Already drafted: say where, rather than suggesting the order a second time.
          <>
            <span className="font-semibold">{t.units(f.count(draft.quantity))}</span>
            <p className="text-sm text-ink-2">
              {t.onDraft}{" "}
              <Link
                href={`/orders/${draft.orderId}`}
                transitionTypes={NAV_FORWARD}
                className="relative z-10 font-mono text-xs text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              >
                {poNumber(draft.orderId)}
              </Link>
            </p>
          </>
        ) : (
          <>
            <span className="font-semibold">{t.units(f.count(row.suggestedQuantity))}</span>
            <p className="text-sm text-ink-2">{m.money(suggestedCost)}</p>
          </>
        )}
      </td>
    </tr>
  );
}

/** The same label, unprinted: the tally fields and rows hold their space while data loads. */
function AttentionPlaceholder({ t }: { t: DashboardCopy }) {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={t.tallies} />
      <div className="px-5 pt-6 sm:px-8">
        <div className="h-5 w-36 bg-liner" />
        <div className="mt-6 space-y-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-9 bg-liner/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

const en = {
  title: "Dashboard",
  tallies: ["Out of stock", "Reorder now", "Cost to reorder"],
  attention: "Needs attention",
  nothing:
    "Nothing to reorder. Every product has more stock, counting what's already on order, than it will sell before its supplier could deliver.",
  coverHelp:
    "Cover is how long stock lasts at the last 28 days' sales. The mark on each bar is the supplier's lead time: cover short of it runs out before a new order can arrive.",
  draft: "Draft the orders",
  product: "Product",
  onHand: "On hand",
  onOrder: "On order",
  cover: "Cover",
  suggested: "Suggested order",
  order: "Order",
  units: (n: string) => `${n} units`,
  onDraft: "On draft",
};
type DashboardCopy = typeof en;

const COPY: Copy<DashboardCopy> = {
  en,
  bn: {
    title: "ড্যাশবোর্ড",
    tallies: ["স্টক শেষ", "এখনই অর্ডার দিন", "অর্ডারের খরচ"],
    attention: "নজর দরকার",
    nothing:
      "এখন কিছু অর্ডার করার নেই। অর্ডারে থাকা মাল ধরে প্রতিটি পণ্যের মজুত সরবরাহকারীর পৌঁছানোর আগ পর্যন্ত বিক্রির চেয়ে বেশি।",
    coverHelp:
      "চলবে মানে গত ২৮ দিনের বিক্রির হারে মজুত কত দিন টিকবে। প্রতিটি বারের খাড়া দাগটি সরবরাহকারীর সরবরাহ সময়: যার মজুত সেই দাগের আগেই ফুরায়, নতুন অর্ডার পৌঁছানোর আগে তা শেষ হয়ে যাবে।",
    draft: "অর্ডারের খসড়া করুন",
    product: "পণ্য",
    onHand: "মজুত",
    onOrder: "অর্ডারে",
    cover: "চলবে",
    suggested: "প্রস্তাবিত অর্ডার",
    order: "অর্ডার",
    units: (n) => `${n} ইউনিট`,
    onDraft: "খসড়ায় আছে",
  },
};
