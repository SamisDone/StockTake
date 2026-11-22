import type { PurchaseOrderStatus } from "@/db/schema";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { ORDERS_COPY } from "./copy";

/** The date that matters for an order's state, in words: "Drafted Nov 3", "Due Nov 28", "Received Nov 12". */
export function orderWhen(
  order: {
    status: PurchaseOrderStatus;
    createdAt: Date;
    dueAt: Date | null;
    receivedAt: Date | null;
    cancelledAt: Date | null;
  },
  now: Date,
  language: Language,
) {
  const day = (date: Date | null) => (date ? formats(language).date(date, now) : "–");
  const when = ORDERS_COPY[language].when;
  if (order.status === "draft") return when.draft(day(order.createdAt));
  if (order.status === "ordered") return when.ordered(day(order.dueAt));
  if (order.status === "received") return when.received(day(order.receivedAt));
  return when.cancelled(day(order.cancelledAt));
}

/**
 * An order's status as a printed mark. Placed is the live one, so it's reverse print;
 * a draft isn't committed yet, so its rule is a cut line; received and cancelled are
 * history, ruled in ink and in grey. Every mark carries a 1px rule, so all four are
 * the same size and a change of status never shifts the line.
 */
export const ORDER_MARK: Record<PurchaseOrderStatus, string> = {
  draft: "border-dashed border-ink-3 text-ink-2",
  ordered: "border-ink bg-ink text-label",
  received: "border-ink text-ink",
  cancelled: "border-ink-3 text-ink-3",
};

export const MARK_BASE = "inline-block rounded-mark border px-1.5 py-px text-xs font-bold whitespace-nowrap";
