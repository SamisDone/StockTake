import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import Link from "next/link";
import { type StockForecast, getStockForecasts } from "@/domain/forecast";
import { formatCount, formatMoney, formatWholeMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { CoverBar, MobileName, StatusMark, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { getCurrentUser } from "@/server/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageTransition>
      <PageHeader title="Dashboard" />
      <Reveal fallback={<AttentionPlaceholder />}>
        <Attention />
      </Reveal>
    </PageTransition>
  );
}

type Forecast = StockForecast;

async function Attention() {
  await getCurrentUser();
  // Forecasts are relative to now, so they belong to the request, never to a prerender.
  await connection();
  const forecasts = await getStockForecasts(await getDb());
  const attention = forecasts.filter((f) => f.status !== "ok");
  const out = attention.filter((f) => f.status === "out").length;
  const reorderCost = attention.reduce((sum, f) => sum + f.suggestedQuantity * f.unitCostCents, 0);

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name="Out of stock" value={out} />
        <Tally name="Reorder now" value={attention.length - out} />
        <Tally name="Cost to reorder" value={formatWholeMoney(reorderCost)} />
      </dl>

      <section aria-labelledby="attention-title" className="pt-6 pb-8">
        <h2 id="attention-title" className="px-5 text-lg font-bold sm:px-8">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="mt-2 max-w-prose px-5 text-ink-2 sm:px-8">
            Nothing to reorder. Every product has more stock, counting what&apos;s already on order, than it will sell
            before its supplier could deliver.
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-prose px-5 text-sm text-ink-2 sm:px-8">
              Cover is how long stock lasts at the last 28 days&apos; sales. The mark on each bar is the supplier&apos;s
              lead time: cover short of it runs out before a new order can arrive.
            </p>
            {/* A table from md up, running to the sheet's edges so a row's hover fill does too;
                below md each row stacks into a small label of named fields. */}
            <table className="mt-4 w-full border-collapse text-left max-md:block">
              <thead className="max-md:hidden">
                <tr className="border-b border-ink">
                  <Th>Product</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">On order</Th>
                  <Th className="w-[30%]">Cover</Th>
                  <Th align="right">Suggested order</Th>
                </tr>
              </thead>
              <tbody className="max-md:block max-md:border-t max-md:border-ink">
                {attention.map((f) => (
                  <AttentionRow key={f.id} forecast={f} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}

function AttentionRow({ forecast: f }: { forecast: Forecast }) {
  const suggestedCost = f.suggestedQuantity * f.unitCostCents;

  return (
    <tr className="relative border-b border-hairline align-top transition-colors duration-150 last:border-b-0 hover:bg-liner/60 max-md:grid max-md:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0 md:pl-8">
        <div className="flex items-baseline gap-2">
          <StatusMark status={f.status} />
          {/* The name links to the product; its hit area stretches over the whole row. */}
          <Link
            href={`/products/${f.id}`}
            prefetch={false}
            transitionTypes={NAV_FORWARD}
            className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {f.name}
          </Link>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          <span className="font-mono text-xs">{f.sku}</span>
          {f.supplierName ? <> · {f.supplierName}</> : null}
        </p>
      </td>
      <td className="tabular py-3 pr-4 text-right text-lg font-semibold max-md:p-0 max-md:text-left">
        <MobileName>On hand</MobileName>
        {formatCount(f.onHand)}
      </td>
      <td className="tabular py-3 pr-4 text-right text-ink-2 max-md:hidden">
        {f.onOrder > 0 ? formatCount(f.onOrder) : "–"}
      </td>
      <td className="py-3 pr-6 max-md:p-0">
        <MobileName>Cover</MobileName>
        <CoverBar daysOfCover={f.daysOfCover} leadTimeDays={f.leadTimeDays} />
      </td>
      <td className="tabular py-3 text-right max-md:p-0 max-md:text-left md:pr-8">
        <MobileName>Order</MobileName>
        <span className="font-semibold">{formatCount(f.suggestedQuantity)} units</span>
        <p className="text-sm text-ink-2">{formatMoney(suggestedCost)}</p>
      </td>
    </tr>
  );
}

/** The same label, unprinted: the tally fields and rows hold their space while data loads. */
function AttentionPlaceholder() {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={["Out of stock", "Reorder now", "Cost to reorder"]} />
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
