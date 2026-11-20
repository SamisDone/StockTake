import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { products, suppliers } from "@/db/schema";
import { logActivity } from "./activity";
import { type Actor, requireAdmin } from "./actor";
import { DomainError, parseInput, violates } from "./errors";
import { cents, containsPattern, id, optionalText, wholeUnits } from "./input";

export const productInput = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{0,31}$/, "Use up to 32 letters, numbers, dots, dashes or underscores."),
  name: z.string().trim().min(1, "Enter a name.").max(120),
  description: optionalText(2000),
  category: optionalText(60),
  supplierId: id.nullable().optional(),
  unitCostCents: cents,
  unitPriceCents: cents,
  reorderPoint: wholeUnits,
  reorderQuantity: wholeUnits,
});
export type ProductInput = z.input<typeof productInput>;

async function assertSupplierExists(db: Database, supplierId: number | null | undefined) {
  if (supplierId == null) return;
  const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) throw new DomainError("not_found", "That supplier doesn't exist.", "supplierId");
}

function skuConflict(error: unknown): never {
  if (violates(error, "UNIQUE constraint failed: products.sku")) {
    throw new DomainError("conflict", "Another product already uses that SKU.", "sku");
  }
  throw error;
}

function toRow(input: z.output<typeof productInput>) {
  return {
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    supplierId: input.supplierId ?? null,
    unitCostCents: input.unitCostCents,
    unitPriceCents: input.unitPriceCents,
    reorderPoint: input.reorderPoint,
    reorderQuantity: input.reorderQuantity,
  };
}

/** Adds a product with no stock; opening stock is recorded as a count. Admin-only. */
export async function createProduct(db: Database, actor: Actor, raw: ProductInput, now = new Date()) {
  requireAdmin(actor, "add products");
  const input = parseInput(productInput, raw);
  await assertSupplierExists(db, input.supplierId);

  try {
    const [[product]] = await db.batch([
      db
        .insert(products)
        .values({ ...toRow(input), createdAt: now })
        .returning({ id: products.id }),
      logActivity(
        db,
        actor,
        {
          action: "product.created",
          entityType: "product",
          // Inside the atomic batch, the new product is max(id); see createDraft.
          entityId: sql<number>`(SELECT max(${products.id}) FROM ${products})`,
          summary: `Added ${input.name} (${input.sku})`,
        },
        now,
      ),
    ]);
    return { id: product.id };
  } catch (error) {
    skuConflict(error);
  }
}

async function loadProduct(db: Database, productId: number) {
  const [product] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId));
  if (!product) throw new DomainError("not_found", "That product doesn't exist.");
  return product;
}

/** Edits a product's details. Stock only changes through movements. Admin-only. */
export async function updateProduct(
  db: Database,
  actor: Actor,
  productId: number,
  raw: ProductInput,
  now = new Date(),
) {
  requireAdmin(actor, "edit products");
  const input = parseInput(productInput, raw);
  await loadProduct(db, productId);
  await assertSupplierExists(db, input.supplierId);

  try {
    await db.batch([
      db.update(products).set(toRow(input)).where(eq(products.id, productId)),
      logActivity(
        db,
        actor,
        { action: "product.updated", entityType: "product", entityId: productId, summary: `Updated ${input.name}` },
        now,
      ),
    ]);
  } catch (error) {
    skuConflict(error);
  }
}

async function setArchived(db: Database, actor: Actor, productId: number, archived: boolean, now: Date) {
  requireAdmin(actor, archived ? "archive products" : "restore products");
  const product = await loadProduct(db, productId);
  await db.batch([
    db
      .update(products)
      .set({ archivedAt: archived ? now : null })
      .where(eq(products.id, productId)),
    logActivity(
      db,
      actor,
      {
        action: archived ? "product.archived" : "product.restored",
        entityType: "product",
        entityId: productId,
        summary: `${archived ? "Archived" : "Restored"} ${product.name}`,
      },
      now,
    ),
  ]);
}

/** Hides a product from the catalog. Its stock history stays. */
export const archiveProduct = (db: Database, actor: Actor, productId: number, now = new Date()) =>
  setArchived(db, actor, productId, true, now);

export const restoreProduct = (db: Database, actor: Actor, productId: number, now = new Date()) =>
  setArchived(db, actor, productId, false, now);

const listColumns = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  category: products.category,
  onHand: products.onHand,
  reorderPoint: products.reorderPoint,
  unitCostCents: products.unitCostCents,
  unitPriceCents: products.unitPriceCents,
  supplierId: products.supplierId,
  supplierName: suppliers.name,
  archivedAt: products.archivedAt,
};

/** Products by name, optionally filtered by a search over name and SKU, or by category. */
export async function listProducts(
  db: Database,
  { query, category, includeArchived = false }: { query?: string; category?: string; includeArchived?: boolean } = {},
) {
  const search = query?.trim();
  const pattern = search ? containsPattern(search) : undefined;
  return db
    .select(listColumns)
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(
      and(
        includeArchived ? undefined : isNull(products.archivedAt),
        category ? eq(products.category, category) : undefined,
        pattern
          ? or(sql`${products.name} LIKE ${pattern} ESCAPE '!'`, sql`${products.sku} LIKE ${pattern} ESCAPE '!'`)
          : undefined,
      ),
    )
    .orderBy(asc(products.name));
}

export async function getProduct(db: Database, productId: number) {
  const [product] = await db
    .select({
      ...listColumns,
      description: products.description,
      reorderQuantity: products.reorderQuantity,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(eq(products.id, productId));
  if (!product) throw new DomainError("not_found", "That product doesn't exist.");
  return product;
}

/** Distinct categories in use, for filters. */
export async function listCategories(db: Database) {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(isNull(products.archivedAt), sql`${products.category} IS NOT NULL`))
    .orderBy(asc(products.category));
  return rows.map((row) => row.category as string);
}
