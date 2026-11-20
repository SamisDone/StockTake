import { type SQL, asc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { products, purchaseOrderLines, purchaseOrders, stockMovements, suppliers } from "@/db/schema";
import { DomainError } from "./errors";
import { outer } from "./input";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Demand is the average over this many days. */
export const DEMAND_WINDOW_DAYS = 28;
/** A reorder covers the lead time plus this many days of demand. */
export const COVER_TARGET_DAYS = 30;
/** Lead time assumed for products with no supplier. */
const DEFAULT_LEAD_TIME_DAYS = 7;

export type StockStatus = "out" | "reorder" | "ok";

export type ForecastInput = {
  onHand: number;
  /** Units on placed, not yet received purchase orders. */
  onOrder: number;
  /** Average units per day. */
  dailyDemand: number;
  leadTimeDays: number;
  reorderPoint: number;
  reorderQuantity: number;
};

export function forecast(input: ForecastInput, now = new Date()) {
  const { onHand, onOrder, dailyDemand, leadTimeDays, reorderPoint, reorderQuantity } = input;

  const daysOfCover = onHand === 0 ? 0 : dailyDemand > 0 ? onHand / dailyDemand : null;
  const stockoutAt = daysOfCover === null ? null : new Date(now.getTime() + daysOfCover * DAY_MS);

  // Stock that is already on its way counts towards the decision to reorder.
  const position = onHand + onOrder;
  const needsReorder = position <= reorderPoint || (dailyDemand > 0 && position / dailyDemand <= leadTimeDays);

  const suggestedQuantity = needsReorder
    ? Math.max(reorderQuantity, Math.ceil(dailyDemand * (leadTimeDays + COVER_TARGET_DAYS)) - position, 1)
    : 0;

  const status: StockStatus = onHand === 0 ? "out" : needsReorder ? "reorder" : "ok";
  return { daysOfCover, stockoutAt, status, suggestedQuantity };
}

const urgency: Record<StockStatus, number> = { out: 0, reorder: 1, ok: 2 };

/**
 * Stock, demand and supply for products, with the forecast worked out. `where` picks
 * the products; the demand window ends at `now`.
 */
async function forecastRows(db: Database, where: SQL | undefined, now: Date) {
  const since = new Date(now.getTime() - DEMAND_WINDOW_DAYS * DAY_MS);

  const onOrder = sql<number>`(
    SELECT coalesce(sum(${purchaseOrderLines.quantity}), 0)
    FROM ${purchaseOrderLines}
    JOIN ${purchaseOrders} ON ${purchaseOrders.id} = ${purchaseOrderLines.purchaseOrderId}
    WHERE ${purchaseOrderLines.productId} = ${outer(products, "id")} AND ${purchaseOrders.status} = 'ordered'
  )`;
  // Sales are negative and returns positive, so the negated sum is net units sold.
  const netSold = sql<number>`(
    SELECT coalesce(-sum(${stockMovements.quantity}), 0)
    FROM ${stockMovements}
    WHERE ${stockMovements.productId} = ${outer(products, "id")}
      AND ${stockMovements.kind} IN ('sale', 'return')
      AND ${stockMovements.occurredAt} >= ${since.getTime()}
  )`;

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      description: products.description,
      category: products.category,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      onHand: products.onHand,
      reorderPoint: products.reorderPoint,
      reorderQuantity: products.reorderQuantity,
      unitCostCents: products.unitCostCents,
      unitPriceCents: products.unitPriceCents,
      archivedAt: products.archivedAt,
      leadTimeDays: sql<number>`coalesce(${suppliers.leadTimeDays}, ${DEFAULT_LEAD_TIME_DAYS})`.mapWith(Number),
      onOrder: onOrder.mapWith(Number),
      netSold: netSold.mapWith(Number),
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(where)
    .orderBy(asc(products.name));

  return rows.map(({ netSold: sold, ...row }) => {
    const dailyDemand = Math.max(sold, 0) / DEMAND_WINDOW_DAYS;
    return { ...row, dailyDemand, ...forecast({ ...row, dailyDemand }, now) };
  });
}

export type StockForecast = Awaited<ReturnType<typeof forecastRows>>[number];

/** A forecast for every active product, most urgent first. */
export async function getStockForecasts(db: Database, now = new Date()) {
  const rows = await forecastRows(db, isNull(products.archivedAt), now);
  return rows.sort(
    (a, b) =>
      urgency[a.status] - urgency[b.status] ||
      (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) ||
      a.name.localeCompare(b.name),
  );
}

/** One product's forecast, archived or not. */
export async function getProductForecast(db: Database, productId: number, now = new Date()) {
  const [row] = await forecastRows(db, eq(products.id, productId), now);
  if (!row) throw new DomainError("not_found", "That product doesn't exist.");
  return row;
}
