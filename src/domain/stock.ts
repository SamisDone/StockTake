import { and, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { Database } from "@/db/database";
import { type MovementKind, products, purchaseOrderLines, stockMovements, users } from "@/db/schema";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { said } from "./error-copy";
import { DomainError, parseInput, violates } from "./errors";
import { outer } from "./input";

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

async function loadStockedProduct(db: Database, id: number) {
  const [product] = await db
    .select({ id: products.id, name: products.name, onHand: products.onHand, archivedAt: products.archivedAt })
    .from(products)
    .where(eq(products.id, id));
  if (!product) throw new DomainError("not_found", said("noProduct"));
  if (product.archivedAt) throw archivedError(product.name);
  return product;
}

const archivedError = (name: string) =>
  new DomainError("invalid_state", said("productArchivedStock", { product: name }));

const selectOnHand = (db: Database, id: number) =>
  db.select({ onHand: products.onHand }).from(products).where(eq(products.id, id));

/** Records a sale, return or write-off, with its activity entry, in one atomic batch. */
export async function recordStockChange(db: Database, actor: Actor, raw: StockChangeInput, now = new Date()) {
  const input = parseInput(stockChangeInput, raw);
  const product = await loadStockedProduct(db, input.productId);
  const signed = input.kind === "return" ? input.quantity : -input.quantity;

  try {
    const [[movement], , [after]] = await db.batch([
      db
        .insert(stockMovements)
        .values({
          productId: product.id,
          kind: input.kind,
          quantity: signed,
          note: input.note,
          userId: actor.id,
          occurredAt: now,
        })
        .returning({ id: stockMovements.id }),
      logActivity(
        db,
        actor,
        {
          action: `stock.${input.kind}`,
          entityType: "product",
          entityId: product.id,
          facts: { name: product.name, quantity: input.quantity, ...(input.note ? { note: input.note } : {}) },
        },
        now,
      ),
      selectOnHand(db, product.id),
    ]);
    return { onHand: after.onHand, movementId: movement.id, name: product.name };
  } catch (error) {
    if (violates(error, "products_on_hand_nonnegative")) {
      const [current] = await selectOnHand(db, product.id);
      throw new DomainError(
        "insufficient_stock",
        said("notEnoughStock", { product: product.name, onHand: current.onHand }),
      );
    }
    // Archived between the read and the write; the database refused it.
    if (violates(error, "product is archived")) throw archivedError(product.name);
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

  const log = logActivity(
    db,
    actor,
    {
      action: "stock.counted",
      entityType: "product",
      entityId: product.id,
      facts: {
        name: product.name,
        counted: input.counted,
        was: product.onHand,
        ...(input.note ? { note: input.note } : {}),
      },
    },
    now,
  );

  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [log];
  if (difference !== 0) {
    statements.unshift(
      db
        .insert(stockMovements)
        .values({
          productId: product.id,
          kind: "adjustment",
          quantity: sql`${input.counted} - (SELECT ${products.onHand} FROM ${products} WHERE ${products.id} = ${product.id})`,
          note: input.note,
          userId: actor.id,
          occurredAt: now,
        })
        .returning({ id: stockMovements.id }),
    );
  }
  let results: unknown[];
  try {
    results = await db.batch(statements);
  } catch (error) {
    if (violates(error, "product is archived")) throw archivedError(product.name);
    throw error;
  }
  // A count that matches writes no movement, so there's nothing to undo.
  const movementId = difference === 0 ? null : (results[0] as { id: number }[])[0].id;
  return { onHand: input.counted, difference, movementId, name: product.name };
}

/**
 * How long after recording a line its author can still undo it. The toast offers Undo
 * for five seconds; the rest is room for a slow connection, never a way to rewrite
 * history later (that's a correction: a new count or entry).
 */
export const UNDO_WINDOW_MS = 60_000;

/**
 * Undoes a line its author just recorded by appending its exact reverse: an adjustment
 * of the opposite quantity that names the line it reverses. Nothing is deleted. The
 * database checks the reverse matches and that a line is undone once; this checks who
 * and when, and says plainly why not.
 */
export async function undoMovement(db: Database, actor: Actor, movementId: number, now = new Date()) {
  const id = parseInput(productId, movementId);
  const [line] = await db
    .select({
      id: stockMovements.id,
      kind: stockMovements.kind,
      quantity: stockMovements.quantity,
      userId: stockMovements.userId,
      occurredAt: stockMovements.occurredAt,
      reversesId: stockMovements.reversesId,
      productId: products.id,
      name: products.name,
      archivedAt: products.archivedAt,
      undone: sql<number>`EXISTS (SELECT 1 FROM ${stockMovements} r WHERE r.reverses_id = ${outer(stockMovements, "id")})`,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(eq(stockMovements.id, id));
  if (!line) throw new DomainError("not_found", said("noMovement"));
  if (line.kind === "receipt" || line.reversesId !== null) throw new DomainError("invalid_state", said("cantUndo"));
  if (line.undone) throw new DomainError("invalid_state", said("alreadyUndone"));
  if (line.userId !== actor.id) throw new DomainError("forbidden", said("undoNotYours"));
  if (now.getTime() - line.occurredAt.getTime() > UNDO_WINDOW_MS) {
    throw new DomainError("invalid_state", said("undoTooLate"));
  }
  if (line.archivedAt) throw archivedError(line.name);

  try {
    const [, , [after]] = await db.batch([
      db.insert(stockMovements).values({
        productId: line.productId,
        kind: "adjustment",
        quantity: -line.quantity,
        reversesId: line.id,
        userId: actor.id,
        occurredAt: now,
      }),
      logActivity(
        db,
        actor,
        {
          action: "stock.undone",
          entityType: "product",
          entityId: line.productId,
          facts: { name: line.name, undid: line.kind, quantity: Math.abs(line.quantity) },
        },
        now,
      ),
      selectOnHand(db, line.productId),
    ]);
    return { onHand: after.onHand, productId: line.productId, name: line.name };
  } catch (error) {
    if (violates(error, "products_on_hand_nonnegative")) {
      const [current] = await selectOnHand(db, line.productId);
      throw new DomainError(
        "insufficient_stock",
        said("undoNotEnough", { product: line.name, onHand: current.onHand }),
      );
    }
    if (violates(error, "stock_movements.reverses_id")) throw new DomainError("invalid_state", said("alreadyUndone"));
    if (violates(error, "product is archived")) throw archivedError(line.name);
    throw error;
  }
}

/** Where a page of the ledger ends: the oldest movement shown so far. */
export type LedgerCursor = { occurredAt: Date; id: number };

/**
 * A product's ledger, newest first, with the running balance after each movement. With
 * `before`, the page of movements older than that one. The balance stays right on any
 * page: it sums from the first movement, and every movement older than the cursor is in.
 */
export async function listMovements(
  db: Database,
  id: number,
  { limit = 50, before }: { limit?: number; before?: LedgerCursor } = {},
) {
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
      /** On an undo: the line it reverses, and that line's kind. */
      reversesId: stockMovements.reversesId,
      reversedKind: sql<MovementKind | null>`(SELECT o.kind FROM ${stockMovements} o WHERE o.id = ${outer(stockMovements, "reversesId")})`,
      /** Whether a later line undid this one. */
      undone:
        sql<boolean>`EXISTS (SELECT 1 FROM ${stockMovements} r WHERE r.reverses_id = ${outer(stockMovements, "id")})`.mapWith(
          Boolean,
        ),
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.id, stockMovements.purchaseOrderLineId))
    .where(
      and(
        eq(stockMovements.productId, id),
        before
          ? sql`(${stockMovements.occurredAt}, ${stockMovements.id}) < (${before.occurredAt.getTime()}, ${before.id})`
          : undefined,
      ),
    )
    .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id))
    .limit(limit);
}

/** How many movements a product's ledger holds, for saying how much of it is shown. */
export async function countMovements(db: Database, id: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(stockMovements)
    .where(eq(stockMovements.productId, id));
  return row.count;
}
