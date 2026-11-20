import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { products, supplierReviews, suppliers, users } from "@/db/schema";
import { logActivity } from "./activity";
import { type Actor, requireAdmin } from "./actor";
import { DomainError, parseInput } from "./errors";
import { optionalText, outer } from "./input";

export const supplierInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: optionalText(254).pipe(z.email("Enter a valid email address.").optional()),
  phone: optionalText(40),
  leadTimeDays: z.number().int().min(0, "Can't be negative.").max(365, "Use 365 days or fewer."),
});
export type SupplierInput = z.input<typeof supplierInput>;

export const reviewInput = z.object({
  rating: z.number().int().min(1, "Choose 1 to 5 stars.").max(5, "Choose 1 to 5 stars."),
  comment: optionalText(1000),
});
export type ReviewInput = z.input<typeof reviewInput>;

async function loadSupplier(db: Database, supplierId: number) {
  const [supplier] = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId));
  if (!supplier) throw new DomainError("not_found", "That supplier doesn't exist.");
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
  requireAdmin(actor, "add suppliers");
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
        summary: `Added supplier ${input.name}`,
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
  requireAdmin(actor, "edit suppliers");
  const input = parseInput(supplierInput, raw);
  await loadSupplier(db, supplierId);
  await db.batch([
    db.update(suppliers).set(toRow(input)).where(eq(suppliers.id, supplierId)),
    logActivity(
      db,
      actor,
      { action: "supplier.updated", entityType: "supplier", entityId: supplierId, summary: `Updated ${input.name}` },
      now,
    ),
  ]);
}

/** Hides a supplier from lists and new orders. Its history stays. Admin-only. */
export async function archiveSupplier(db: Database, actor: Actor, supplierId: number, now = new Date()) {
  requireAdmin(actor, "archive suppliers");
  const supplier = await loadSupplier(db, supplierId);
  await db.batch([
    db.update(suppliers).set({ archivedAt: now }).where(eq(suppliers.id, supplierId)),
    logActivity(
      db,
      actor,
      {
        action: "supplier.archived",
        entityType: "supplier",
        entityId: supplierId,
        summary: `Archived ${supplier.name}`,
      },
      now,
    ),
  ]);
}

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
        summary: `Rated ${supplier.name} ${input.rating}/5`,
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
  if (!supplier) throw new DomainError("not_found", "That supplier doesn't exist.");

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
