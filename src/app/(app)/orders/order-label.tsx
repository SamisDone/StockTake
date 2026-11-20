import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getOrder } from "@/domain/purchase-orders";
import { Tally, TallyPlaceholder } from "@/components/stock";
import { formatCount, formatDate, formatDays, formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/server/dal";
import { OrderControls } from "./order-controls";
import { STATUS_WORD } from "./status";

/** An order ID from the URL, or a 404 for anything that isn't one. */
export function orderId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

type Order = Awaited<ReturnType<typeof getOrder>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A purchase order printed as one label: who it's for, what state it's in and why,
 * what can be done with it next, its lines with the total, and its history.
 */
export async function OrderLabel({ id, action }: { id: number; action: ReactNode }) {
  const user = await getCurrentUser();
  await connection();
  const db = await getDb();
  const now = new Date();

  let order: Order;
  try {
    order = await getOrder(db, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const units = order.lines.reduce((total, line) => total + line.quantity, 0);
  const late = order.dueAt !== null && order.dueAt < now;

  return (
    <article aria-labelledby="order-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="order-title" className="print-display text-4xl text-balance sm:text-5xl">
            {order.supplierName}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            <span className="font-mono text-xs">{order.number}</span> · {STATUS_WORD[order.status]}
          </p>
        </div>
        {action}
      </header>

      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name="Lines" value={order.lines.length} />
        <Tally name="Units" value={units} />
        <Tally name="Total" value={formatMoney(order.totalCents)} />
      </dl>

      <Status order={order} late={late} now={now} />

      <OrderControls
        orderId={order.id}
        number={order.number}
        status={order.status}
        isAdmin={user.role === "admin"}
        receipts={order.lines.map((line) => `+${formatCount(line.quantity)} ${line.name}`).join(", ")}
      />

      <section aria-labelledby="lines-title" className="pt-5">
        <h2 id="lines-title" className="px-5 text-lg font-bold sm:px-8">
          Lines
        </h2>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <LineTh className="w-full pl-5 sm:pl-8">Product</LineTh>
              <LineTh align="right">Quantity</LineTh>
              <LineTh align="right" className="max-sm:hidden">
                Unit cost
              </LineTh>
              <LineTh align="right" className="pr-5 sm:pr-8">
                Line total
              </LineTh>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-hairline align-top last:border-b-0">
                <td className="py-2.5 pr-4 pl-5 sm:pl-8">
                  <Link
                    href={`/products/${line.productId}`}
                    prefetch={false}
                    className="font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                  >
                    {line.name}
                  </Link>
                  <p className="font-mono text-xs text-ink-3">{line.sku}</p>
                </td>
                <td className="tabular py-2.5 pr-4 text-right">{formatCount(line.quantity)}</td>
                <td className="tabular py-2.5 pr-4 text-right text-ink-2 max-sm:hidden">
                  {formatMoney(line.unitCostCents)}
                </td>
                <td className="tabular py-2.5 pr-5 text-right font-semibold sm:pr-8">
                  {formatMoney(line.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* The total, reverse-printed: the figure the order commits to. */}
        <div className="mt-3 flex items-baseline justify-between gap-4 bg-ink px-5 py-3 text-label sm:px-8">
          <p className="font-semibold">Total</p>
          <p className="print-display text-[1.75rem] sm:text-5xl">{formatMoney(order.totalCents)}</p>
        </div>
      </section>

      <section aria-labelledby="history-title" className="pt-5 pb-8">
        <h2 id="history-title" className="px-5 text-lg font-bold sm:px-8">
          History
        </h2>
        <ol className="mt-2 px-5 text-sm sm:px-8">
          <HistoryLine date={order.createdAt} now={now}>
            Drafted by {order.createdByName}
          </HistoryLine>
          {order.orderedAt ? (
            <HistoryLine date={order.orderedAt} now={now}>
              Placed with {order.supplierName}
            </HistoryLine>
          ) : null}
          {order.receivedAt ? (
            <HistoryLine date={order.receivedAt} now={now}>
              Received: {formatCount(order.lines.length)} {order.lines.length === 1 ? "receipt" : "receipts"} booked
              into stock
            </HistoryLine>
          ) : null}
          {order.cancelledAt ? (
            <HistoryLine date={order.cancelledAt} now={now}>
              Cancelled
            </HistoryLine>
          ) : null}
        </ol>
        {order.notes ? (
          <div className="mt-3 px-5 sm:px-8">
            <p className="field-name">Notes</p>
            <p className="mt-0.5 max-w-prose text-sm">{order.notes}</p>
          </div>
        ) : null}
      </section>
    </article>
  );
}

/**
 * Why the order is where it is, in one sentence. Late is the one state that needs
 * attention, so it's printed on yellow stock. Announced when an action changes it.
 */
function Status({ order, late, now }: { order: Order; late: boolean; now: Date }) {
  let lead: string;
  let text: string;
  if (order.status === "draft") {
    lead = "Draft.";
    text = `Nothing has been sent. Placing it sends it to ${order.supplierName}, and its units count as on order from then.`;
  } else if (order.status === "ordered") {
    const due = order.dueAt ? formatDate(order.dueAt, now) : null;
    const basis = order.expectedAt ? "the date they gave" : `a ${order.leadTimeDays}‑day lead time`;
    if (late && order.dueAt) {
      lead = "Late.";
      const overdue = Math.max(1, Math.floor((now.getTime() - order.dueAt.getTime()) / DAY_MS));
      text = `It was due ${due}, ${formatDays(overdue)} ago (${basis}). Receive it when it arrives, or cancel it.`;
    } else {
      lead = "On its way.";
      text = `Due ${due ?? "–"}, from ${basis}. Receiving it books every line into stock.`;
    }
  } else if (order.status === "received") {
    lead = "Received.";
    text = "Each line was booked into stock as a receipt, and shows in its product's ledger.";
  } else {
    lead = "Cancelled.";
    text = "Nothing was received, and it can't be reopened.";
  }

  return (
    <div
      id="order-status"
      tabIndex={-1}
      aria-live="polite"
      className={`border-b-2 border-ink px-5 py-3 outline-none sm:px-8 ${late ? "bg-stock" : ""}`}
    >
      <p className="max-w-prose text-sm">
        <strong className="font-bold">{lead}</strong> {text}
      </p>
    </div>
  );
}

function HistoryLine({ date, now, children }: { date: Date; now: Date; children: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="w-16 shrink-0 text-ink-2">{formatDate(date, now)}</span>
      <span>{children}</span>
    </li>
  );
}

function LineTh({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`field-name pt-1 pr-4 pb-2 whitespace-nowrap ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

/** The same label, unprinted, in the shape of what will print. */
export function OrderLabelPlaceholder({ action }: { action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-32 bg-liner/70" />
        </div>
        {action}
      </div>
      <TallyPlaceholder names={["Lines", "Units", "Total"]} />
      <div className="border-b-2 border-ink px-5 py-3 sm:px-8">
        <div className="h-5 w-4/5 bg-liner/70" />
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
