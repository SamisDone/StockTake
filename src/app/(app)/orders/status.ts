import type { PurchaseOrderStatus } from "@/db/schema";
import { formatDate } from "@/lib/format";

/** An order's state, as the people using it say it. "Ordered" reads as placed. */
export const STATUS_WORD: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  ordered: "Placed",
  received: "Received",
  cancelled: "Cancelled",
};

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
) {
  const day = (date: Date | null) => (date ? formatDate(date, now) : "–");
  if (order.status === "draft") return `Drafted ${day(order.createdAt)}`;
  if (order.status === "ordered") return `Due ${day(order.dueAt)}`;
  if (order.status === "received") return `Received ${day(order.receivedAt)}`;
  return `Cancelled ${day(order.cancelledAt)}`;
}
