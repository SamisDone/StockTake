import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getStockForecasts } from "@/domain/forecast";
import { formatCount, formatDays, formatMoney, formatWholeMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/transitions";
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

/** Cover bars share one scale, so any two rows compare at a glance. */
const SCALE_DAYS = 45;

type Forecast = Awaited<ReturnType<typeof getStockForecasts>>[number];

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

      <section aria-labelledby="attention-title" className="px-5 pt-6 pb-8 sm:px-8">
        <h2 id="attention-title" className="text-lg font-bold">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="mt-2 max-w-prose text-ink-2">
            Nothing to reorder. Every product has more stock, counting what&apos;s already on order, than it will sell
            before its supplier could deliver.
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              Cover is how long stock lasts at the last 28 days&apos; sales. The mark on each bar is the supplier&apos;s
              lead time: cover short of it runs out before a new order can arrive.
            </p>
            {/* A table from md up; below that each row stacks into a small label of named fields. */}
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

/** One field of the label's tally zone: its name small, the value printed large. */
function Tally({ name, value }: { name: string; value: number | string }) {
  return (
    <div className="border-l border-ink px-5 pt-3 pb-4 first:border-l-0 sm:px-8">
      <dt className="field-name">{name}</dt>
      <dd className="print-display mt-1 text-[1.75rem] sm:text-5xl">
        {typeof value === "number" ? formatCount(value) : value}
      </dd>
    </div>
  );
}

function AttentionRow({ forecast: f }: { forecast: Forecast }) {
  const suggestedCost = f.suggestedQuantity * f.unitCostCents;

  return (
    <tr className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] max-md:gap-x-5 max-md:gap-y-3 max-md:py-4">
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0">
        <div className="flex items-baseline gap-2">
          <StatusMark status={f.status} />
          <span className="font-semibold">{f.name}</span>
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
      <td className="tabular py-3 text-right max-md:p-0 max-md:text-left">
        <MobileName>Order</MobileName>
        <span className="font-semibold">{formatCount(f.suggestedQuantity)} units</span>
        <p className="text-sm text-ink-2">{formatMoney(suggestedCost)}</p>
      </td>
    </tr>
  );
}

/** A field name shown only when the row stacks, where there are no column headers. */
function MobileName({ children }: { children: React.ReactNode }) {
  return <span className="field-name mb-0.5 block text-left md:hidden">{children}</span>;
}

/** Out is reverse-printed; reorder is printed on yellow attention stock. */
function StatusMark({ status }: { status: Forecast["status"] }) {
  if (status === "ok") return null;
  return status === "out" ? (
    <span className="shrink-0 rounded-[3px] bg-ink px-1.5 py-px text-xs font-bold text-label">Out</span>
  ) : (
    <span className="shrink-0 rounded-[3px] bg-stock px-1.5 py-px text-xs font-bold text-ink">Reorder</span>
  );
}

/** The bar's length is the exact cover on the shared scale; the mark is the lead time. */
function CoverBar({ daysOfCover, leadTimeDays }: { daysOfCover: number | null; leadTimeDays: number }) {
  const position = (days: number) => `${(Math.min(days, SCALE_DAYS) / SCALE_DAYS) * 100}%`;
  const label =
    daysOfCover === null ? "No sales in 28 days" : daysOfCover === 0 ? "None left" : formatDays(daysOfCover);

  return (
    <div>
      <p className="text-sm">
        <span className="font-semibold whitespace-nowrap">{label}</span>
        {/* On a phone the lead time takes its own line, so neither part breaks. */}
        <span className="whitespace-nowrap text-ink-3 max-md:block">
          <span className="max-md:hidden"> · </span>lead {formatDays(leadTimeDays)}
        </span>
      </p>
      <div aria-hidden className="relative mt-2 h-1.5 bg-liner">
        {daysOfCover ? <div className="h-full bg-ink" style={{ width: position(daysOfCover) }} /> : null}
        <div className="absolute -top-1 h-3.5 w-0.5 bg-ink" style={{ left: position(leadTimeDays) }} />
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th scope="col" className={`field-name pt-1 pr-4 pb-2 ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </th>
  );
}

/** The same label, unprinted: the tally fields and rows hold their space while data loads. */
function AttentionPlaceholder() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-3 border-b-2 border-ink">
        {["Out of stock", "Reorder now", "Cost to reorder"].map((name) => (
          <div key={name} className="border-l border-ink px-5 pt-3 pb-4 first:border-l-0 sm:px-8">
            <p className="field-name">{name}</p>
            <div className="mt-2 h-9 w-14 bg-liner sm:h-11" />
          </div>
        ))}
      </div>
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
