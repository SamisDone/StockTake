import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/database";
import { purchaseOrderLines, purchaseOrders } from "@/db/schema";
import type { Actor } from "./actor";
import { DomainError } from "./errors";
import { type StockStatus, getStockForecasts } from "./forecast";
import { createDraft } from "./purchase-orders";

/** One product the forecast says to order, and how many. */
export type SuggestedLine = {
  productId: number;
  sku: string;
  name: string;
  status: StockStatus;
  onHand: number;
  daysOfCover: number | null;
  leadTimeDays: number;
  quantity: number;
  unitCostCents: number;
  /** The draft order this product is already on, if any. */
  draftId: number | null;
};

/** What one supplier should be sent an order for. */
export type SupplierSuggestion = {
  supplierId: number;
  supplierName: string;
  leadTimeDays: number;
  lines: SuggestedLine[];
  /** Lines not on a draft yet: what a new draft would hold. */
  toDraft: number;
  /** Cost of those lines at each product's current unit cost. */
  totalCents: number;
};

/**
 * Everything the forecast says to reorder, grouped by supplier, most urgent supplier
 * first. Stock on placed orders already counts in the forecast; a product on a draft is
 * marked with that draft instead, so the same suggestion isn't drafted twice. Products
 * with no supplier are listed apart: an order needs a supplier.
 */
export async function getReorderSuggestions(db: Database, now = new Date()) {
  const wanted = (await getStockForecasts(db, now)).filter((f) => f.suggestedQuantity > 0);

  const drafted =
    wanted.length === 0
      ? []
      : await db
          .select({ productId: purchaseOrderLines.productId, orderId: purchaseOrders.id })
          .from(purchaseOrderLines)
          .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
          .where(
            and(
              eq(purchaseOrders.status, "draft"),
              inArray(
                purchaseOrderLines.productId,
                wanted.map((f) => f.id),
              ),
            ),
          )
          .orderBy(asc(purchaseOrders.id));
  const draftOf = new Map<number, number>();
  for (const row of drafted) if (!draftOf.has(row.productId)) draftOf.set(row.productId, row.orderId);

  const bySupplier = new Map<number, SupplierSuggestion>();
  const unsupplied: SuggestedLine[] = [];
  // Forecasts come most urgent first, so suppliers and lines keep that order.
  for (const f of wanted) {
    const line: SuggestedLine = {
      productId: f.id,
      sku: f.sku,
      name: f.name,
      status: f.status,
      onHand: f.onHand,
      daysOfCover: f.daysOfCover,
      leadTimeDays: f.leadTimeDays,
      quantity: f.suggestedQuantity,
      unitCostCents: f.unitCostCents,
      draftId: draftOf.get(f.id) ?? null,
    };
    if (f.supplierId === null || f.supplierName === null) {
      unsupplied.push(line);
      continue;
    }
    let group = bySupplier.get(f.supplierId);
    if (!group) {
      group = {
        supplierId: f.supplierId,
        supplierName: f.supplierName,
        leadTimeDays: f.leadTimeDays,
        lines: [],
        toDraft: 0,
        totalCents: 0,
      };
      bySupplier.set(f.supplierId, group);
    }
    group.lines.push(line);
    if (line.draftId === null) {
      group.toDraft += 1;
      group.totalCents += line.quantity * line.unitCostCents;
    }
  }

  return { suppliers: [...bySupplier.values()], unsupplied };
}

/**
 * Drafts an order to one supplier for every suggested line not on a draft yet, worked
 * out again here rather than taken from the page. A person still reviews and places it.
 */
export async function draftSuggestedOrder(db: Database, actor: Actor, supplierId: number, now = new Date()) {
  const { suppliers } = await getReorderSuggestions(db, now);
  const group = suppliers.find((s) => s.supplierId === supplierId);
  const lines = group?.lines.filter((line) => line.draftId === null) ?? [];
  if (!group) throw new DomainError("invalid_state", "Nothing from that supplier needs ordering right now.");
  if (lines.length === 0) {
    throw new DomainError("invalid_state", `Everything ${group.supplierName} should send is on a draft already.`);
  }
  return createDraft(
    db,
    actor,
    {
      supplierId,
      notes: "Drafted from the reorder suggestions.",
      lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    },
    now,
  );
}
