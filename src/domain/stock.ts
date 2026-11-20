import { desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { Database } from "@/db/database";
import { products, purchaseOrderLines, stockMovements, users } from "@/db/schema";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { DomainError, parseInput, violates } from "./errors";

const productId = z.number().int().positive();
const units = z.number().int().positive().max(1_000_000);
const note = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => value || undefined);

/** Sales, returns and write-offs. Receipts only come from purchase orders, and adjustments from counts. */
export const stockChangeInput = z.object({
  productId,
  kind: z.enum(["sale", "return", "write_off"]),
  quantity: units,
  note,
});
export type StockChangeInput = z.input<typeof stockChangeInput>;

/** A physical count. Any difference from the system is recorded as an adjustment. */
export const countInput = z.object({
  productId,
  counted: z.number().int().min(0).max(1_000_000),
  note,
});
export type CountInput = z.input<typeof countInput>;

const changeSummary = {
  sale: (quantity: number, name: string) => `Sold ${quantity} × ${name}`,
  return: (quantity: number, name: string) => `Took back a return of ${quantity} × ${name}`,
  write_off: (quantity: number, name: string) => `Wrote off ${quantity} × ${name}`,
};

async function loadStockedProduct(db: Database, id: number) {
  const [product] = await db
    .select({ id: products.id, name: products.name, onHand: products.onHand, archivedAt: products.archivedAt })
    .from(products)
    .where(eq(products.id, id));
  if (!product) throw new DomainError("not_found", "That product doesn't exist.");
  if (product.archivedAt) {
    throw new DomainError("invalid_state", `${product.name} is archived, so its stock can't change.`);
  }
  return product;
}

const selectOnHand = (db: Database, id: number) =>
  db.select({ onHand: products.onHand }).from(products).where(eq(products.id, id));

/** Records a sale, return or write-off, with its activity entry, in one atomic batch. */
export async function recordStockChange(db: Database, actor: Actor, raw: StockChangeInput, now = new Date()) {
  const input = parseInput(stockChangeInput, raw);
  const product = await loadStockedProduct(db, input.productId);
  const signed = input.kind === "return" ? input.quantity : -input.quantity;
  const summary = changeSummary[input.kind](input.quantity, product.name);

  try {
    const [, , [after]] = await db.batch([
      db.insert(stockMovements).values({
        productId: product.id,
        kind: input.kind,
        quantity: signed,
        note: input.note,
        userId: actor.id,
        occurredAt: now,
      }),
      logActivity(
        db,
        actor,
        {
          action: `stock.${input.kind}`,
          entityType: "product",
          entityId: product.id,
          summary: input.note ? `${summary}: ${input.note}` : summary,
        },
        now,
      ),
      selectOnHand(db, product.id),
    ]);
    return { onHand: after.onHand };
  } catch (error) {
    if (violates(error, "products_on_hand_nonnegative")) {
      const [current] = await selectOnHand(db, product.id);
      throw new DomainError("insufficient_stock", `Only ${current.onHand} × ${product.name} on hand.`);
    }
    throw error;
  }
}

/**
 * Records a physical count. The adjustment is computed in SQL from the on-hand count
 * at write time, so a sale that lands between the read and the write can't skew it.
 */
export async function recordCount(db: Database, actor: Actor, raw: CountInput, now = new Date()) {
  const input = parseInput(countInput, raw);
  const product = await loadStockedProduct(db, input.productId);
  const difference = input.counted - product.onHand;
  const summary =
    difference === 0
      ? `Counted ${input.counted} × ${product.name}, which matches`
      : `Counted ${input.counted} × ${product.name} (was ${product.onHand})`;

  const log = logActivity(
    db,
    actor,
    {
      action: "stock.counted",
      entityType: "product",
      entityId: product.id,
      summary: input.note ? `${summary}: ${input.note}` : summary,
    },
    now,
  );

  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [log];
  if (difference !== 0) {
    statements.unshift(
      db.insert(stockMovements).values({
        productId: product.id,
        kind: "adjustment",
        quantity: sql`${input.counted} - (SELECT ${products.onHand} FROM ${products} WHERE ${products.id} = ${product.id})`,
        note: input.note,
        userId: actor.id,
        occurredAt: now,
      }),
    );
  }
  await db.batch(statements);
  return { onHand: input.counted, difference };
}

/** A product's ledger, newest first, with the running balance after each movement. */
export async function listMovements(db: Database, id: number, { limit = 50 } = {}) {
  const balance = sql<number>`sum(${stockMovements.quantity}) OVER (ORDER BY ${stockMovements.occurredAt}, ${stockMovements.id})`;
  return db
    .select({
      id: stockMovements.id,
      kind: stockMovements.kind,
      quantity: stockMovements.quantity,
      balance: balance.mapWith(Number),
      note: stockMovements.note,
      occurredAt: stockMovements.occurredAt,
      userName: users.name,
      purchaseOrderId: purchaseOrderLines.purchaseOrderId,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.id, stockMovements.purchaseOrderLineId))
    .where(eq(stockMovements.productId, id))
    .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id))
    .limit(limit);
}
