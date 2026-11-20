import { and, asc, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import {
  activityLog,
  type PurchaseOrderStatus,
  products,
  purchaseOrderLines,
  purchaseOrders,
  stockMovements,
  suppliers,
  users,
} from "@/db/schema";
import { formatMoney } from "@/lib/format";
import { type Actor, requireAdmin } from "./actor";
import { DomainError, parseInput, violates } from "./errors";

export const poNumber = (id: number) => `PO-${String(id).padStart(4, "0")}`;

const lineInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(1_000_000),
  /** Defaults to the product's current unit cost. */
  unitCostCents: z.number().int().min(0).max(100_000_000).optional(),
});

export const draftInput = z.object({
  supplierId: z.number().int().positive(),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  expectedAt: z.date().optional(),
  lines: z
    .array(lineInput)
    .min(1, "Add at least one line.")
    .max(200)
    .refine((lines) => new Set(lines.map((l) => l.productId)).size === lines.length, {
      message: "Each product can appear on an order once.",
    }),
});
export type DraftInput = z.input<typeof draftInput>;

type Operation = "edit" | "place" | "cancel" | "receive";

/** Why an order in `status` can't undergo `operation`, phrased for the person. */
function stateError(id: number, status: PurchaseOrderStatus, operation: Operation) {
  const n = poNumber(id);
  const messages: Record<PurchaseOrderStatus, Partial<Record<Operation, string>>> = {
    draft: { receive: `${n} hasn't been placed yet.` },
    ordered: {
      edit: `${n} has been placed, so it can't be edited.`,
      place: `${n} has been placed already.`,
    },
    received: {
      edit: `${n} has been received, so it can't be edited.`,
      place: `${n} has been received already.`,
      cancel: `${n} has been received, so it can't be cancelled.`,
      receive: `${n} has been received already.`,
    },
    cancelled: {
      edit: `${n} was cancelled, so it can't be edited.`,
      place: `${n} was cancelled, so it can't be placed.`,
      cancel: `${n} was cancelled already.`,
      receive: `${n} was cancelled, so it can't be received.`,
    },
  };
  return new DomainError("invalid_state", messages[status][operation] ?? `${n} can't be changed right now.`);
}

const allowed: Record<Operation, PurchaseOrderStatus[]> = {
  edit: ["draft"],
  place: ["draft"],
  cancel: ["draft", "ordered"],
  receive: ["ordered"],
};

async function loadOrder(db: Database, id: number) {
  const [order] = await db
    .select({ id: purchaseOrders.id, status: purchaseOrders.status, supplierName: suppliers.name })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(eq(purchaseOrders.id, id));
  if (!order) throw new DomainError("not_found", "That purchase order doesn't exist.");
  return order;
}

async function loadOrderFor(db: Database, id: number, operation: Operation) {
  const order = await loadOrder(db, id);
  if (!allowed[operation].includes(order.status)) throw stateError(id, order.status, operation);
  return order;
}

/**
 * Runs a write that the database's purchase-order triggers guard. If another request
 * changed the order first, the trigger rejects the write and this reports the order's
 * new status instead of the raw database error.
 */
async function guarded<T>(db: Database, id: number, operation: Operation, write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    const raced =
      violates(error, "purchase order cannot move from") ||
      violates(error, "lines can only change while the order is a draft") ||
      violates(error, "only placed orders can be received") ||
      violates(error, /UNIQUE constraint failed: stock_movements\.purchase_order_line_id/);
    if (!raced) throw error;
    const { status } = await loadOrder(db, id);
    throw stateError(id, status, operation);
  }
}

/** Validates the supplier and products and resolves each line's unit cost. */
async function resolveDraft(db: Database, input: z.output<typeof draftInput>) {
  const [supplier] = await db
    .select({ id: suppliers.id, name: suppliers.name, archivedAt: suppliers.archivedAt })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId));
  if (!supplier) throw new DomainError("not_found", "That supplier doesn't exist.");
  if (supplier.archivedAt) {
    throw new DomainError("invalid_state", `${supplier.name} is archived, so it can't take new orders.`);
  }

  const ids = input.lines.map((line) => line.productId);
  const found = await db
    .select({ id: products.id, name: products.name, unitCostCents: products.unitCostCents, archivedAt: products.archivedAt })
    .from(products)
    .where(inArray(products.id, ids));
  const byId = new Map(found.map((p) => [p.id, p]));

  const lines = input.lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product) throw new DomainError("not_found", "One of those products doesn't exist.");
    if (product.archivedAt) throw new DomainError("invalid_state", `${product.name} is archived.`);
    return { productId: line.productId, quantity: line.quantity, unitCostCents: line.unitCostCents ?? product.unitCostCents };
  });

  const totalCents = lines.reduce((total, line) => total + line.quantity * line.unitCostCents, 0);
  const summary = `${lines.length} ${lines.length === 1 ? "line" : "lines"}, ${formatMoney(totalCents)}`;
  return { supplier, lines, summary };
}

/** Creates a draft order with its lines and activity entry in one atomic batch. */
export async function createDraft(db: Database, actor: Actor, raw: DraftInput, now = new Date()) {
  const input = parseInput(draftInput, raw);
  const { supplier, lines, summary } = await resolveDraft(db, input);

  // A batch can't pass the new order's ID between statements, so the lines and the log
  // entry look it up as max(id). The batch runs atomically, so no other insert can land
  // in between, and SQLite assigns max(id) + 1 to a new INTEGER PRIMARY KEY row.
  const newId = sql<number>`(SELECT max(${purchaseOrders.id}) FROM ${purchaseOrders})`;
  const [[order]] = await db.batch([
    db
      .insert(purchaseOrders)
      .values({
        supplierId: supplier.id,
        notes: input.notes,
        expectedAt: input.expectedAt,
        createdBy: actor.id,
        createdAt: now,
      })
      .returning({ id: purchaseOrders.id }),
    db.insert(purchaseOrderLines).values(lines.map((line) => ({ ...line, purchaseOrderId: newId }))),
    db.insert(activityLog).values({
      userId: actor.id,
      action: "purchase_order.drafted",
      entityType: "purchase_order",
      entityId: newId,
      summary: `Drafted an order with ${supplier.name}: ${summary}`,
      occurredAt: now,
    }),
  ]);
  return { id: order.id };
}

/** Replaces a draft's supplier, notes and lines. */
export async function updateDraft(db: Database, actor: Actor, id: number, raw: DraftInput, now = new Date()) {
  const input = parseInput(draftInput, raw);
  await loadOrderFor(db, id, "edit");
  const { supplier, lines, summary } = await resolveDraft(db, input);

  await guarded(db, id, "edit", () =>
    db.batch([
      db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id)),
      db.insert(purchaseOrderLines).values(lines.map((line) => ({ ...line, purchaseOrderId: id }))),
      db
        .update(purchaseOrders)
        .set({ supplierId: supplier.id, notes: input.notes ?? null, expectedAt: input.expectedAt ?? null })
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.status, "draft"))),
      db.insert(activityLog).values({
        userId: actor.id,
        action: "purchase_order.edited",
        entityType: "purchase_order",
        entityId: id,
        summary: `Edited ${poNumber(id)}: ${summary}`,
        occurredAt: now,
      }),
    ]),
  );
}

async function orderTotal(db: Database, id: number) {
  const [row] = await db
    .select({ total: sum(sql<number>`${purchaseOrderLines.quantity} * ${purchaseOrderLines.unitCostCents}`).mapWith(Number) })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, id));
  return row?.total ?? 0;
}

/** Sends a draft to the supplier. Admin-only, because it commits spending. */
export async function placeOrder(db: Database, actor: Actor, id: number, now = new Date()) {
  requireAdmin(actor, "place purchase orders");
  const order = await loadOrderFor(db, id, "place");
  const total = await orderTotal(db, id);

  await guarded(db, id, "place", () =>
    db.batch([
      db.update(purchaseOrders).set({ status: "ordered", orderedAt: now }).where(eq(purchaseOrders.id, id)),
      db.insert(activityLog).values({
        userId: actor.id,
        action: "purchase_order.placed",
        entityType: "purchase_order",
        entityId: id,
        summary: `Placed ${poNumber(id)} with ${order.supplierName} for ${formatMoney(total)}`,
        occurredAt: now,
      }),
    ]),
  );
}

/** Cancels a draft or a placed order. Admin-only. */
export async function cancelOrder(db: Database, actor: Actor, id: number, now = new Date()) {
  requireAdmin(actor, "cancel purchase orders");
  await loadOrderFor(db, id, "cancel");

  await guarded(db, id, "cancel", () =>
    db.batch([
      db.update(purchaseOrders).set({ status: "cancelled", cancelledAt: now }).where(eq(purchaseOrders.id, id)),
      db.insert(activityLog).values({
        userId: actor.id,
        action: "purchase_order.cancelled",
        entityType: "purchase_order",
        entityId: id,
        summary: `Cancelled ${poNumber(id)}`,
        occurredAt: now,
      }),
    ]),
  );
}

/**
 * Books every line into stock and marks the order received, in one atomic batch. The
 * receipts go in first because the database only accepts the status change once every
 * line has one. A second receive, even a concurrent one, fails as a whole.
 */
export async function receiveOrder(db: Database, actor: Actor, id: number, now = new Date()) {
  const order = await loadOrderFor(db, id, "receive");
  const lines = await db
    .select({ id: purchaseOrderLines.id, productId: purchaseOrderLines.productId, quantity: purchaseOrderLines.quantity })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, id));
  const units = lines.reduce((total, line) => total + line.quantity, 0);

  await guarded(db, id, "receive", () =>
    db.batch([
      db.insert(stockMovements).values(
        lines.map((line) => ({
          productId: line.productId,
          kind: "receipt" as const,
          quantity: line.quantity,
          purchaseOrderLineId: line.id,
          userId: actor.id,
          occurredAt: now,
        })),
      ),
      db.update(purchaseOrders).set({ status: "received", receivedAt: now }).where(eq(purchaseOrders.id, id)),
      db.insert(activityLog).values({
        userId: actor.id,
        action: "purchase_order.received",
        entityType: "purchase_order",
        entityId: id,
        summary: `Received ${poNumber(id)} from ${order.supplierName}: ${units} units`,
        occurredAt: now,
      }),
    ]),
  );
}

/** One order with its supplier, author and lines. */
export async function getOrder(db: Database, id: number) {
  const [order] = await db
    .select({
      id: purchaseOrders.id,
      status: purchaseOrders.status,
      notes: purchaseOrders.notes,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      createdByName: users.name,
      createdAt: purchaseOrders.createdAt,
      expectedAt: purchaseOrders.expectedAt,
      orderedAt: purchaseOrders.orderedAt,
      receivedAt: purchaseOrders.receivedAt,
      cancelledAt: purchaseOrders.cancelledAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .innerJoin(users, eq(users.id, purchaseOrders.createdBy))
    .where(eq(purchaseOrders.id, id));
  if (!order) throw new DomainError("not_found", "That purchase order doesn't exist.");

  const lines = await db
    .select({
      id: purchaseOrderLines.id,
      productId: purchaseOrderLines.productId,
      sku: products.sku,
      name: products.name,
      quantity: purchaseOrderLines.quantity,
      unitCostCents: purchaseOrderLines.unitCostCents,
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(products.id, purchaseOrderLines.productId))
    .where(eq(purchaseOrderLines.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLines.id));

  const withTotals = lines.map((line) => ({ ...line, lineTotalCents: line.quantity * line.unitCostCents }));
  return {
    ...order,
    number: poNumber(order.id),
    lines: withTotals,
    totalCents: withTotals.reduce((total, line) => total + line.lineTotalCents, 0),
  };
}

/** Orders newest first, with line counts and totals. */
export async function listOrders(db: Database, { status }: { status?: PurchaseOrderStatus } = {}) {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      status: purchaseOrders.status,
      supplierName: suppliers.name,
      createdAt: purchaseOrders.createdAt,
      expectedAt: purchaseOrders.expectedAt,
      lineCount: count(purchaseOrderLines.id),
      totalCents: sql<number>`coalesce(sum(${purchaseOrderLines.quantity} * ${purchaseOrderLines.unitCostCents}), 0)`.mapWith(
        Number,
      ),
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .where(status ? eq(purchaseOrders.status, status) : undefined)
    .groupBy(purchaseOrders.id)
    .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id));
  return rows.map((row) => ({ ...row, number: poNumber(row.id) }));
}
