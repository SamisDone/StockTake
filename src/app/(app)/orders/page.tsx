import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listOrders, poNumber } from "@/domain/purchase-orders";
import { type SupplierSuggestion, type SuggestedLine, getReorderSuggestions } from "@/domain/reorder";
import { PageHeader } from "@/components/page-header";
import { MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { formatCount, formatMoney, formatWholeMoney } from "@/lib/format";
import { getCurrentUser } from "@/server/dal";
import { DraftButton } from "./draft-button";
import { type OrderRow, OrderTable } from "./order-table";
import { orderWhen } from "./status";

export const metadata: Metadata = { title: "Purchase orders" };

export default function OrdersPage() {
  return (
    <PageTransition>
      <PageHeader
        title="Purchase orders"
        actions={
          // Anyone can draft an order, so this needs no session and prints with the page.
          <Link
            href="/orders/new"
            prefetch={false}
            transitionTypes={NAV_FORWARD}
            className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
              <Plus aria-hidden size={18} strokeWidth={2.5} />
              New order
            </span>
          </Link>
        }
      />
      <Reveal fallback={<OrdersPlaceholder />}>
        <Orders />
      </Reveal>
    </PageTransition>
  );
}

async function Orders() {
  await getCurrentUser();
  // Lateness and suggestions are relative to now, so they belong to the request.
  await connection();
  const db = await getDb();
  const now = new Date();
  const [orders, suggestions] = await Promise.all([listOrders(db), getReorderSuggestions(db, now)]);

  // Only what the table prints crosses to the browser.
  const rows: OrderRow[] = orders.map((o) => {
    const late = o.dueAt !== null && o.dueAt < now;
    const when = orderWhen(o, now);
    return {
      id: o.id,
      number: o.number,
      supplierName: o.supplierName,
      status: o.status,
      lineCount: o.lineCount,
      totalCents: o.totalCents,
      when,
      late,
    };
  });
  const placed = orders.filter((o) => o.status === "ordered");

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name="Drafts" value={orders.filter((o) => o.status === "draft").length} />
        <Tally name="On order" value={formatWholeMoney(placed.reduce((sum, o) => sum + o.totalCents, 0))} />
        <Tally name="Late" value={rows.filter((r) => r.late).length} />
      </dl>
      <Suggestions suppliers={suggestions.suppliers} unsupplied={suggestions.unsupplied} />
      <OrderTable rows={rows} />
    </>
  );
}

/**
 * What the forecast says to order, one row per supplier. Drafting makes an order a
 * person can still change; nothing is sent until an admin places it.
 */
function Suggestions({ suppliers, unsupplied }: { suppliers: SupplierSuggestion[]; unsupplied: SuggestedLine[] }) {
  return (
    <section aria-labelledby="suggested-title" className="border-b-2 border-ink pt-6 pb-6">
      <div className="px-5 sm:px-8">
        <h2 id="suggested-title" className="text-lg font-bold">
          Suggested orders
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          From the forecast: what each supplier should send so stock, counting what&apos;s already on order, lasts their
          lead time and 30 days more. A draft can still be changed; nothing is sent until an admin places it.
        </p>
      </div>

      {suppliers.length === 0 ? (
        <p className="mt-4 px-5 font-semibold sm:px-8">Nothing to reorder.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left max-md:block">
          <thead className="max-md:hidden">
            <tr className="border-b border-ink">
              <Th>Supplier</Th>
              <Th className="w-full">Products</Th>
              <Th align="right">Cost</Th>
              <Th>
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {suppliers.map((s) => (
              <SuggestionRow key={s.supplierId} suggestion={s} />
            ))}
          </tbody>
        </table>
      )}

      {unsupplied.length > 0 ? (
        <p className="mt-4 max-w-prose px-5 text-sm text-ink-2 sm:px-8">
          Also running low, with no supplier to order from:{" "}
          {unsupplied.map((line, i) => (
            <span key={line.productId}>
              {i > 0 ? ", " : null}
              <Link
                href={`/products/${line.productId}`}
                prefetch={false}
                className="font-semibold text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              >
                {line.name}
              </Link>
            </span>
          ))}
          . An admin gives each one a supplier on its label.
        </p>
      ) : null}
    </section>
  );
}

function SuggestionRow({ suggestion: s }: { suggestion: SupplierSuggestion }) {
  const drafts = [...new Set(s.lines.flatMap((line) => (line.draftId === null ? [] : [line.draftId])))];
  return (
    <tr className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-2 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 whitespace-nowrap max-md:col-span-2 max-md:p-0 md:pl-8">
        <p className="font-semibold">{s.supplierName}</p>
        <p className="text-sm text-ink-3">{s.leadTimeDays}‑day lead time</p>
      </td>
      <td className="py-3 pr-4 max-md:col-span-2 max-md:p-0">
        <MobileName>Products</MobileName>
        <ul className="text-sm">
          {s.lines.map((line) => (
            <li key={line.productId} className={line.draftId === null ? "" : "text-ink-3"}>
              {line.name} × {formatCount(line.quantity)}
              {line.draftId !== null ? <> · on {poNumber(line.draftId)}</> : null}
            </li>
          ))}
        </ul>
      </td>
      <td className="tabular py-3 pr-4 text-right whitespace-nowrap max-md:p-0 max-md:text-left">
        <MobileName>Cost</MobileName>
        {s.toDraft > 0 ? (
          <span className="font-semibold">{formatMoney(s.totalCents)}</span>
        ) : (
          <span className="text-ink-2">–</span>
        )}
      </td>
      <td className="py-2 whitespace-nowrap max-md:p-0 md:pr-8">
        {s.toDraft > 0 ? (
          <DraftButton supplierId={s.supplierId} supplierName={s.supplierName} />
        ) : (
          <span className="text-sm text-ink-2">
            On{" "}
            {drafts.map((id, i) => (
              <span key={id}>
                {i > 0 ? ", " : null}
                <Link
                  href={`/orders/${id}`}
                  prefetch={false}
                  transitionTypes={NAV_FORWARD}
                  className="font-semibold text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                >
                  {poNumber(id)}
                </Link>
              </span>
            ))}
          </span>
        )}
      </td>
    </tr>
  );
}

/** The same label, unprinted: tallies, the suggestions and the rows hold their space. */
function OrdersPlaceholder() {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={["Drafts", "On order", "Late"]} />
      <div className="border-b-2 border-ink px-5 pt-6 pb-6 sm:px-8">
        <p className="text-lg font-bold">Suggested orders</p>
        <div className="mt-2 h-4 w-4/5 bg-liner/70" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-12 bg-liner/70" />
          ))}
        </div>
      </div>
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
