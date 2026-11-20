import type { PurchaseOrderStatus } from "@/db/schema";

/** An order's state, as the people using it say it. "Ordered" reads as placed. */
export const STATUS_WORD: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  ordered: "Placed",
  received: "Received",
  cancelled: "Cancelled",
};
