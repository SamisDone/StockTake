import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { Database } from "@/db/database";
import { customers, paymentMethods, payments, products, saleLines, sales, stockMovements, users } from "@/db/schema";
import { logActivity } from "./activity";
import { type Actor, requireAdmin } from "./actor";
import { said } from "./error-copy";
import { DomainError, parseInput, violates } from "./errors";
import { cents, id, optionalText, outer } from "./input";

/**
 * Sales with prices: one or more products at the price they went for, a discount on a
 * line or on the whole sale, the customer (or a walk-in), and what was paid then. What's
 * left unpaid is the customer's due, paid off later. Each line takes its stock as a sale
 * movement in the ledger; voiding the sale reverses them. Sales and payments are never
 * edited or deleted, by the database's rules (drizzle/0010_sales_rules.sql).
 */

export const saleNumber = (saleId: number) => `S-${String(saleId).padStart(4, "0")}`;

export const saleInput = z.object({
  customerId: id.nullable().optional(),
  lines: z
    .array(
      z.object({
        productId: id,
        quantity: z.number().int().positive("quantityPositive").max(1_000_000, "quantityTooLarge"),
        unitPriceCents: cents,
        discountCents: cents.default(0),
      }),
    )
    .min(1, "addLine"),
  discountCents: cents.default(0),
  paidCents: cents,
  method: z.enum(paymentMethods),
  note: optionalText(500),
});
export type SaleInput = z.input<typeof saleInput>;

/**
 * Each line's net: its own total less its discount, less its share of the sale's
 * discount, shared by the lines' totals in whole cents (largest remainders take the odd
 * cents), so the nets add up to the sale's total exactly.
 */
export function allocateNet(lines: { grossCents: number }[], discountCents: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.grossCents, 0);
  if (subtotal === 0 || discountCents === 0) return lines.map((line) => line.grossCents);
  const exact = lines.map((line) => (discountCents * line.grossCents) / subtotal);
  const shares = exact.map(Math.floor);
  let left = discountCents - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left === 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return lines.map((line, index) => line.grossCents - shares[index]);
}

/** A sale's figures from its lines as entered: each line's gross and net, and the totals. */
export function saleFigures(
  lines: { quantity: number; unitPriceCents: number; discountCents: number }[],
  discountCents: number,
) {
  const gross = lines.map((line) => line.quantity * line.unitPriceCents - line.discountCents);
  const subtotalCents = gross.reduce((sum, value) => sum + value, 0);
  const nets = allocateNet(
    gross.map((grossCents) => ({ grossCents: Math.max(grossCents, 0) })),
    Math.min(discountCents, Math.max(subtotalCents, 0)),
  );
  return {
    gross,
    nets,
    subtotalCents,
    totalCents: subtotalCents - discountCents,
    listCents: lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0),
  };
}

/**
 * Records a sale: its lines, the stock each takes, what was paid, and an activity entry,
 * in one atomic batch. Anyone can sell. A walk-in pays in full; a customer can pay part
 * or nothing, and the rest is their due. The database refuses the whole sale if any
 * line would take more than is on hand.
 */
export async function recordSale(db: Database, actor: Actor, raw: SaleInput, now = new Date()) {
  const input = parseInput(saleInput, raw);
  const customerId = input.customerId ?? null;

  const ids = input.lines.map((line) => line.productId);
  if (new Set(ids).size !== ids.length) throw new DomainError("invalid_input", said("productOnce"), "lines");
  input.lines.forEach((line, index) => {
    if (line.discountCents > line.quantity * line.unitPriceCents) {
      throw new DomainError("invalid_input", said("discountTooLarge"), `discount-${index}`);
    }
  });
  const figures = saleFigures(input.lines, input.discountCents);
  if (input.discountCents > figures.subtotalCents) {
    throw new DomainError("invalid_input", said("discountTooLarge"), "discount");
  }
  if (input.paidCents > figures.totalCents) throw new DomainError("invalid_input", said("paidTooMuch"), "paid");
  if (customerId === null && input.paidCents !== figures.totalCents) {
    throw new DomainError("invalid_input", said("walkInPays"), "paid");
  }

  const stocked = await db
    .select({ id: products.id, name: products.name, onHand: products.onHand, archivedAt: products.archivedAt })
    .from(products)
    .where(inArray(products.id, ids));
  const byId = new Map(stocked.map((p) => [p.id, p]));
  input.lines.forEach((line, index) => {
    const product = byId.get(line.productId);
    if (!product) throw new DomainError("not_found", said("noProducts"), `quantity-${index}`);
    if (product.archivedAt)
      throw new DomainError("invalid_state", said("productArchivedStock", { product: product.name }));
    if (product.onHand < line.quantity) {
      throw new DomainError(
        "insufficient_stock",
        said("notEnoughStock", { product: product.name, onHand: product.onHand }),
        `quantity-${index}`,
      );
    }
  });

  let customerName: string | null = null;
  if (customerId !== null) {
    const [customer] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, customerId));
    if (!customer) throw new DomainError("not_found", said("noCustomer"), "customerId");
    customerName = customer.name;
  }

  // Inside the atomic batch, the sale just written is max(id); see createDraft.
  const thisSale = sql<number>`(SELECT max(${sales.id}) FROM ${sales})`;
  const lineOf = (productId: number) =>
    sql<number>`(SELECT ${saleLines.id} FROM ${saleLines} WHERE ${saleLines.saleId} = (SELECT max(${sales.id}) FROM ${sales}) AND ${saleLines.productId} = ${productId})`;

  const statements: BatchItem<"sqlite">[] = [
    ...input.lines.map((line, index) =>
      db.insert(saleLines).values({
        saleId: thisSale,
        productId: line.productId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountCents: line.discountCents,
        netCents: figures.nets[index],
      }),
    ),
    ...input.lines.map((line) =>
      db.insert(stockMovements).values({
        productId: line.productId,
        kind: "sale",
        quantity: -line.quantity,
        saleLineId: lineOf(line.productId),
        userId: actor.id,
        occurredAt: now,
      }),
    ),
  ];
  if (input.paidCents > 0) {
    statements.push(
      db.insert(payments).values({
        customerId,
        saleId: thisSale,
        amountCents: input.paidCents,
        method: input.method,
        receivedAt: now,
        userId: actor.id,
      }),
    );
  }
  statements.push(
    logActivity(
      db,
      actor,
      {
        action: "sale.recorded",
        entityType: "sale",
        entityId: thisSale,
        facts: {
          ...(customerName ? { customer: customerName } : {}),
          lines: input.lines.length,
          totalCents: figures.totalCents,
          dueCents: figures.totalCents - input.paidCents,
        },
      },
      now,
    ),
  );

  try {
    const [[sale]] = await db.batch([
      db
        .insert(sales)
        .values({
          customerId,
          discountCents: input.discountCents,
          note: input.note ?? null,
          soldAt: now,
          createdBy: actor.id,
        })
        .returning({ id: sales.id }),
      ...statements,
    ]);
    return {
      id: sale.id,
      number: saleNumber(sale.id),
      totalCents: figures.totalCents,
      dueCents: figures.totalCents - input.paidCents,
    };
  } catch (error) {
    if (violates(error, "products_on_hand_nonnegative") || violates(error, "product is archived")) {
      // Sold or archived elsewhere between the check and the write: name the line.
      const fresh = await db
        .select({ id: products.id, name: products.name, onHand: products.onHand, archivedAt: products.archivedAt })
        .from(products)
        .where(inArray(products.id, ids));
      const index = Math.max(
        0,
        input.lines.findIndex((line) => {
          const p = fresh.find((x) => x.id === line.productId);
          return !p || p.archivedAt !== null || p.onHand < line.quantity;
        }),
      );
      const product = fresh.find((p) => p.id === input.lines[index].productId)!;
      if (product.archivedAt) {
        throw new DomainError("invalid_state", said("productArchivedStock", { product: product.name }));
      }
      throw new DomainError(
        "insufficient_stock",
        said("notEnoughStock", { product: product.name, onHand: product.onHand }),
        `quantity-${index}`,
      );
    }
    throw error;
  }
}

/** A sale's lines with each one's product and the movement that took its stock. */
async function linesOf(db: Database, saleIds: number[]) {
  if (saleIds.length === 0) return [];
  return db
    .select({
      id: saleLines.id,
      saleId: saleLines.saleId,
      productId: saleLines.productId,
      sku: products.sku,
      name: products.name,
      quantity: saleLines.quantity,
      unitPriceCents: saleLines.unitPriceCents,
      discountCents: saleLines.discountCents,
      netCents: saleLines.netCents,
      movementId: stockMovements.id,
    })
    .from(saleLines)
    .innerJoin(products, eq(products.id, saleLines.productId))
    .leftJoin(stockMovements, eq(stockMovements.saleLineId, saleLines.id))
    .where(inArray(saleLines.saleId, saleIds))
    .orderBy(asc(saleLines.id));
}

/**
 * Takes a sale back: its stock returns to the shelves (each line's movement reversed in
 * the ledger) and it no longer counts in what its customer owes. Admins only. Money paid
 * isn't refunded here; a customer who paid for it is left in credit.
 */
export async function voidSale(db: Database, actor: Actor, saleId: number, now = new Date()) {
  requireAdmin(actor, "voidSales");
  const sale = await loadSale(db, saleId);
  if (sale.voidedAt) throw new DomainError("invalid_state", said("saleVoided", { sale: saleNumber(saleId) }));
  const lines = await linesOf(db, [saleId]);
  const totalCents = lines.reduce((sum, line) => sum + line.netCents, 0);

  try {
    await db.batch([
      db.update(sales).set({ voidedAt: now, voidedBy: actor.id }).where(eq(sales.id, saleId)),
      ...lines.map((line) =>
        db.insert(stockMovements).values({
          productId: line.productId,
          kind: "adjustment",
          quantity: line.quantity,
          reversesId: line.movementId!,
          userId: actor.id,
          occurredAt: now,
        }),
      ),
      logActivity(
        db,
        actor,
        {
          action: "sale.voided",
          entityType: "sale",
          entityId: saleId,
          facts: {
            sale: saleNumber(saleId),
            ...(sale.customerName ? { customer: sale.customerName } : {}),
            totalCents,
          },
        },
        now,
      ),
    ]);
  } catch (error) {
    if (violates(error, "sale is voided already")) {
      throw new DomainError("invalid_state", said("saleVoided", { sale: saleNumber(saleId) }));
    }
    if (violates(error, "product is archived")) {
      throw new DomainError("invalid_state", said("voidArchived", { sale: saleNumber(saleId) }));
    }
    throw error;
  }
}

async function loadSale(db: Database, saleId: number) {
  const [sale] = await db
    .select({
      id: sales.id,
      customerId: sales.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      discountCents: sales.discountCents,
      note: sales.note,
      soldAt: sales.soldAt,
      createdByName: users.name,
      voidedAt: sales.voidedAt,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .innerJoin(users, eq(users.id, sales.createdBy))
    .where(eq(sales.id, saleId));
  if (!sale) throw new DomainError("not_found", said("noSale"));
  return sale;
}

/** The outer query's sale, named with its table so a subquery can't mistake it for its own ID. */
const saleId = outer(sales, "id");

/** What was paid at each sale. */
const paidAtSale = sql<number>`coalesce((SELECT sum(${payments.amountCents}) FROM ${payments} WHERE ${payments.saleId} = ${saleId}), 0)`;

/** Each sale's total, from its lines. */
const saleTotal = sql<number>`coalesce((SELECT sum(${saleLines.netCents}) FROM ${saleLines} WHERE ${saleLines.saleId} = ${saleId}), 0)`;

/**
 * What's still owed on each of a customer's sales. Money paid at a sale settles that
 * sale; payments taken later (and anything paid for a sale since voided) settle the
 * oldest sale first, the way a shop's credit book is kept. Voided sales owe nothing.
 */
export function settle<T extends { id: number; totalCents: number; voided: boolean; paidAtSaleCents: number }>(
  saleList: T[],
  laterCents: number,
) {
  const ordered = [...saleList].sort((a, b) => a.id - b.id);
  let pool = laterCents;
  const owed = new Map<number, number>();
  for (const sale of ordered) {
    if (sale.voided) pool += sale.paidAtSaleCents;
    else {
      const own = Math.min(sale.paidAtSaleCents, sale.totalCents);
      pool += sale.paidAtSaleCents - own;
      owed.set(sale.id, sale.totalCents - own);
    }
  }
  for (const sale of ordered) {
    if (sale.voided) {
      owed.set(sale.id, 0);
      continue;
    }
    const settled = Math.min(owed.get(sale.id) ?? 0, pool);
    pool -= settled;
    owed.set(sale.id, (owed.get(sale.id) ?? 0) - settled);
  }
  return owed;
}

/** Recent sales, newest first, with each one's customer, total and what's still owed on it. */
export async function listSales(
  db: Database,
  { limit = 200, customerId }: { limit?: number; customerId?: number } = {},
) {
  const rows = await db
    .select({
      id: sales.id,
      customerId: sales.customerId,
      customerName: customers.name,
      soldAt: sales.soldAt,
      voidedAt: sales.voidedAt,
      lineCount: sql<number>`(SELECT count(*) FROM ${saleLines} WHERE ${saleLines.saleId} = ${saleId})`.mapWith(Number),
      units:
        sql<number>`coalesce((SELECT sum(${saleLines.quantity}) FROM ${saleLines} WHERE ${saleLines.saleId} = ${saleId}), 0)`.mapWith(
          Number,
        ),
      totalCents: saleTotal.mapWith(Number),
      paidAtSaleCents:
        sql<number>`coalesce((SELECT sum(${payments.amountCents}) FROM ${payments} WHERE ${payments.saleId} = ${saleId}), 0)`.mapWith(
          Number,
        ),
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(customerId !== undefined ? eq(sales.customerId, customerId) : undefined)
    .orderBy(desc(sales.soldAt), desc(sales.id))
    .limit(limit);

  const owed = await owedBySale(db, [
    ...new Set(rows.flatMap((row) => (row.customerId === null ? [] : [row.customerId]))),
  ]);
  return rows.map((row) => ({
    ...row,
    number: saleNumber(row.id),
    voided: row.voidedAt !== null,
    dueCents: row.customerId === null || row.voidedAt ? 0 : (owed.get(row.id) ?? 0),
  }));
}

/** For each sale of these customers, what's still owed on it (see `settle`). */
async function owedBySale(db: Database, customerIds: number[]) {
  const owed = new Map<number, number>();
  if (customerIds.length === 0) return owed;
  const [all, later] = await Promise.all([
    db
      .select({
        id: sales.id,
        customerId: sales.customerId,
        voided: sql<boolean>`${sales.voidedAt} IS NOT NULL`.mapWith(Boolean),
        totalCents: saleTotal.mapWith(Number),
        paidAtSaleCents: paidAtSale.mapWith(Number),
      })
      .from(sales)
      .where(inArray(sales.customerId, customerIds)),
    db
      .select({ customerId: payments.customerId, cents: sql<number>`sum(${payments.amountCents})`.mapWith(Number) })
      .from(payments)
      .where(and(inArray(payments.customerId, customerIds), isNull(payments.saleId)))
      .groupBy(payments.customerId),
  ]);
  for (const customerId of customerIds) {
    const theirs = all.filter((sale) => sale.customerId === customerId);
    const settled = settle(theirs, later.find((p) => p.customerId === customerId)?.cents ?? 0);
    for (const [saleId, cents] of settled) owed.set(saleId, cents);
  }
  return owed;
}

/** One sale with its lines, payments taken at the sale, and what's still owed on it. */
export async function getSale(db: Database, saleId: number) {
  const sale = await loadSale(db, saleId);
  const [lines, paid] = await Promise.all([
    linesOf(db, [saleId]),
    db
      .select({ amountCents: payments.amountCents, method: payments.method, receivedAt: payments.receivedAt })
      .from(payments)
      .where(eq(payments.saleId, saleId))
      .orderBy(asc(payments.id)),
  ]);
  const totalCents = lines.reduce((sum, line) => sum + line.netCents, 0);
  const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents - line.discountCents, 0);
  const owed = sale.customerId === null ? new Map<number, number>() : await owedBySale(db, [sale.customerId]);
  return {
    ...sale,
    number: saleNumber(sale.id),
    lines,
    payments: paid,
    subtotalCents,
    totalCents,
    paidAtSaleCents: paid.reduce((sum, p) => sum + p.amountCents, 0),
    dueCents: sale.customerId === null || sale.voidedAt ? 0 : (owed.get(sale.id) ?? 0),
  };
}

/** Totals for the sales page: today and the period since `since.period`, voided sales left out. */
export async function salesSummary(db: Database, since: { today: Date; period: Date }) {
  const standing = and(isNull(sales.voidedAt), sql`${sales.soldAt} >= ${since.period.getTime()}`);
  const [period] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      totalCents: sql<number>`coalesce(sum(${saleTotal}), 0)`.mapWith(Number),
      todayCount:
        sql<number>`coalesce(sum(CASE WHEN ${sales.soldAt} >= ${since.today.getTime()} THEN 1 END), 0)`.mapWith(Number),
      todayCents:
        sql<number>`coalesce(sum(CASE WHEN ${sales.soldAt} >= ${since.today.getTime()} THEN ${saleTotal} END), 0)`.mapWith(
          Number,
        ),
    })
    .from(sales)
    .where(standing);
  return period;
}
