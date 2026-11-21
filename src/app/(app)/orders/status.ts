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
