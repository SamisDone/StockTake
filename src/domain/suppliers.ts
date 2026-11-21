import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { products, purchaseOrders, supplierReviews, suppliers, users } from "@/db/schema";
import { logActivity } from "./activity";
import { type Actor, requireAdmin } from "./actor";
import { said } from "./error-copy";
import { DomainError, parseInput } from "./errors";
import { optionalText, outer } from "./input";
import { poNumber } from "./purchase-orders";

export const supplierInput = z.object({
  name: z.string().trim().min(1, "enterName").max(120),
  email: optionalText(254).pipe(z.email("enterEmail").optional()),
  phone: optionalText(40),
  leadTimeDays: z.number().int().min(0, "notNegative").max(365, "leadTimeTooLong"),
});
export type SupplierInput = z.input<typeof supplierInput>;

export const reviewInput = z.object({
  rating: z.number().int().min(1, "starsRange").max(5, "starsRange"),
  comment: optionalText(1000),
});
export type ReviewInput = z.input<typeof reviewInput>;

async function loadSupplier(db: Database, supplierId: number) {
  const [supplier] = await db
    .select({ id: suppliers.id, name: suppliers.name, archivedAt: suppliers.archivedAt })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId));
  if (!supplier) throw new DomainError("not_found", said("noSupplier"));
  return supplier;
}

const toRow = (input: z.output<typeof supplierInput>) => ({
  name: input.name,
  email: input.email ?? null,
  phone: input.phone ?? null,
  leadTimeDays: input.leadTimeDays,
});

/** Adds a supplier. Admin-only. */
export async function createSupplier(db: Database, actor: Actor, raw: SupplierInput, now = new Date()) {
  requireAdmin(actor, "addSuppliers");
  const input = parseInput(supplierInput, raw);
  const [[supplier]] = await db.batch([
    db
      .insert(suppliers)
      .values({ ...toRow(input), createdAt: now })
      .returning({ id: suppliers.id }),
    logActivity(
      db,
      actor,
      {
        action: "supplier.created",
        entityType: "supplier",
        // Inside the atomic batch, the new supplier is max(id); see createDraft.
        entityId: sql<number>`(SELECT max(${suppliers.id}) FROM ${suppliers})`,
        facts: { name: input.name },
      },
      now,
    ),
  ]);
  return { id: supplier.id };
}

/** Edits a supplier. Admin-only. */
export async function updateSupplier(
  db: Database,
  actor: Actor,
  supplierId: number,
  raw: SupplierInput,
  now = new Date(),
) {
  requireAdmin(actor, "editSuppliers");
  const input = parseInput(supplierInput, raw);
  const supplier = await loadSupplier(db, supplierId);
  if (supplier.archivedAt) {
    throw new DomainError("invalid_state", said("supplierArchivedEdit", { supplier: supplier.name }));
  }
  await db.batch([
    db.update(suppliers).set(toRow(input)).where(eq(suppliers.id, supplierId)),
    logActivity(
      db,
      actor,
      { action: "supplier.updated", entityType: "supplier", entityId: supplierId, facts: { name: input.name } },
      now,
    ),
  ]);
}

/** Refuses while the supplier has drafts or placed orders: archiving would strand them. */
async function assertNoOpenOrders(db: Database, supplier: { id: number; name: string }) {
  const open = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.supplierId, supplier.id), inArray(purchaseOrders.status, ["draft", "ordered"])))
    .orderBy(asc(purchaseOrders.id));
  if (open.length === 0) return;
  throw new DomainError(
    "invalid_state",
    said("supplierHasOpenOrders", { supplier: supplier.name, orders: open.map((order) => poNumber(order.id)) }),
  );
}

async function setArchived(db: Database, actor: Actor, supplierId: number, archived: boolean, now: Date) {
  requireAdmin(actor, archived ? "archiveSuppliers" : "restoreSuppliers");
  const supplier = await loadSupplier(db, supplierId);
  if (archived) await assertNoOpenOrders(db, supplier);
  await db.batch([
    db
      .update(suppliers)
      .set({ archivedAt: archived ? now : null })
      .where(eq(suppliers.id, supplierId)),
    logActivity(
      db,
      actor,
      {
        action: archived ? "supplier.archived" : "supplier.restored",
        entityType: "supplier",
        entityId: supplierId,
        facts: { name: supplier.name },
      },
      now,
    ),
  ]);
}

/**
 * Hides a supplier from lists and new orders; its products can't be ordered until it's
 * restored or they get another supplier. Its history stays. Refused while it has open
 * orders. Admin-only.
 */
export const archiveSupplier = (db: Database, actor: Actor, supplierId: number, now = new Date()) =>
  setArchived(db, actor, supplierId, true, now);

/** Puts an archived supplier back. Admin-only. */
export const restoreSupplier = (db: Database, actor: Actor, supplierId: number, now = new Date()) =>
  setArchived(db, actor, supplierId, false, now);

/** Adds the person's review of a supplier, or replaces their earlier one. */
export async function reviewSupplier(
  db: Database,
  actor: Actor,
  supplierId: number,
  raw: ReviewInput,
  now = new Date(),
) {
  const input = parseInput(reviewInput, raw);
  const supplier = await loadSupplier(db, supplierId);
  const values = { rating: input.rating, comment: input.comment ?? null, createdAt: now };
  await db.batch([
    db
      .insert(supplierReviews)
      .values({ ...values, supplierId, userId: actor.id })
      .onConflictDoUpdate({ target: [supplierReviews.supplierId, supplierReviews.userId], set: values }),
    logActivity(
      db,
      actor,
      {
        action: "supplier.reviewed",
        entityType: "supplier",
        entityId: supplierId,
        facts: { name: supplier.name, rating: input.rating },
      },
      now,
    ),
  ]);
}

/** Removes the person's own review. */
export async function deleteReview(db: Database, actor: Actor, supplierId: number) {
  await db
    .delete(supplierReviews)
    .where(and(eq(supplierReviews.supplierId, supplierId), eq(supplierReviews.userId, actor.id)));
}

const averageRating = sql<number | null>`(
  SELECT avg(${supplierReviews.rating}) FROM ${supplierReviews} WHERE ${supplierReviews.supplierId} = ${outer(suppliers, "id")}
)`;
const reviewCount = sql<number>`(
  SELECT count(*) FROM ${supplierReviews} WHERE ${supplierReviews.supplierId} = ${outer(suppliers, "id")}
)`;
const productCount = sql<number>`(
  SELECT count(*) FROM ${products} WHERE ${products.supplierId} = ${outer(suppliers, "id")} AND ${products.archivedAt} IS NULL
)`;

const summaryColumns = {
  id: suppliers.id,
  name: suppliers.name,
  email: suppliers.email,
  phone: suppliers.phone,
  leadTimeDays: suppliers.leadTimeDays,
  archivedAt: suppliers.archivedAt,
  averageRating: averageRating.mapWith((value) => (value === null ? null : Number(value))),
  reviewCount: reviewCount.mapWith(Number),
  productCount: productCount.mapWith(Number),
};

/** Suppliers by name, with their average rating and active product count. */
export async function listSuppliers(db: Database, { includeArchived = false } = {}) {
  return db
    .select(summaryColumns)
    .from(suppliers)
    .where(includeArchived ? undefined : isNull(suppliers.archivedAt))
    .orderBy(asc(suppliers.name));
}

/** One supplier with its reviews, newest first. */
export async function getSupplier(db: Database, supplierId: number) {
  const [supplier] = await db.select(summaryColumns).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) throw new DomainError("not_found", said("noSupplier"));

  const reviews = await db
    .select({
      userId: supplierReviews.userId,
      userName: users.name,
      rating: supplierReviews.rating,
      comment: supplierReviews.comment,
      createdAt: supplierReviews.createdAt,
    })
    .from(supplierReviews)
    .innerJoin(users, eq(users.id, supplierReviews.userId))
    .where(eq(supplierReviews.supplierId, supplierId))
    .orderBy(desc(supplierReviews.createdAt), desc(supplierReviews.id));

  return { ...supplier, reviews };
}
