import { type AnyColumn, type SQL, and, asc, eq, gte, lt, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { products, purchaseOrders, stockMovements, suppliers } from "@/db/schema";
import { arrivedOnTime, daysTaken, poNumber } from "./purchase-orders";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The periods the analytics page offers, in days ending today (UTC). */
export const PERIODS = [28, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

/** How many products each of the product lists names. */
export const LIST_LENGTH = 5;

/** The category name for products that have none. */
export const UNCATEGORISED = "Uncategorised";

/** A period from a URL value: one of `PERIODS`, else the first. */
export function readPeriod(raw: string | undefined): PeriodDays {
  const days = Number(raw);
  return (PERIODS as readonly number[]).includes(days) ? (days as PeriodDays) : PERIODS[0];
}

/** A period of `days` whole UTC days ending with today, so today's entries count. */
export function periodRange(days: number, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { from: new Date(today - (days - 1) * DAY_MS), to: now };
}

/** Sums a movement column over the rows that match `when`, or 0. */
const total = (when: SQL) => sql<number>`coalesce(sum(CASE WHEN ${when} THEN ${stockMovements.quantity} END), 0)`;

/**
 * Each product's ledger split at the period's edges: what the movements before it add up
 * to (the opening stock), each kind of movement inside it, and anything after it. All
 * products are here, archived ones too, so the totals cover every unit the ledger holds.
 */
async function ledgerRows(db: Database, from: Date, to: Date) {
  const before = sql`${stockMovements.occurredAt} < ${from.getTime()}`;
  const inside = (kind: string, extra?: SQL) =>
    sql`${stockMovements.occurredAt} >= ${from.getTime()} AND ${stockMovements.occurredAt} < ${to.getTime()} AND ${stockMovements.kind} = ${kind}${extra ? sql` AND ${extra}` : sql``}`;

  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      archived: sql<boolean>`${products.archivedAt} IS NOT NULL`.mapWith(Boolean),
      onHand: products.onHand,
      unitCostCents: products.unitCostCents,
      unitPriceCents: products.unitPriceCents,
      opening: total(before).mapWith(Number),
      received: total(inside("receipt")).mapWith(Number),
      returned: total(inside("return")).mapWith(Number),
      sold: total(inside("sale")).mapWith(Number),
      writtenOff: total(inside("write_off")).mapWith(Number),
      countFound: total(inside("adjustment", sql`${stockMovements.quantity} > 0`)).mapWith(Number),
      countShort: total(inside("adjustment", sql`${stockMovements.quantity} < 0`)).mapWith(Number),
      after: total(sql`${stockMovements.occurredAt} >= ${to.getTime()}`).mapWith(Number),
    })
    .from(products)
    .leftJoin(stockMovements, eq(stockMovements.productId, products.id))
    .groupBy(products.id)
    .orderBy(asc(products.name));
}

export type LedgerRow = Awaited<ReturnType<typeof ledgerRows>>[number];

/**
 * The period's ledger by UTC day: net units sold (sales less returns) valued at today's
 * prices and costs, and how much every movement that day changed the stock at cost.
 */
async function dayRows(db: Database, from: Date, to: Date) {
  const day = sql<number>`cast(${stockMovements.occurredAt} / ${DAY_MS} as integer)`;
  const selling = sql`${stockMovements.kind} IN ('sale', 'return')`;
  const sold = (per: SQL | AnyColumn) =>
    sql<number>`-coalesce(sum(CASE WHEN ${selling} THEN ${stockMovements.quantity} * ${per} END), 0)`.mapWith(Number);
  return db
    .select({
      day: day.mapWith(Number),
      units: sold(sql`1`),
      valueCents: sold(products.unitPriceCents),
      costCents: sold(products.unitCostCents),
      stockChangeCents: sql<number>`sum(${stockMovements.quantity} * ${products.unitCostCents})`.mapWith(Number),
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(gte(stockMovements.occurredAt, from), lt(stockMovements.occurredAt, to)))
    .groupBy(day)
    .orderBy(day);
}

type DayRow = Awaited<ReturnType<typeof dayRows>>[number];

export type SalesDay = { day: Date; units: number; valueCents: number; costCents: number };

/** Stock at today's unit costs at the end of a day; for today, as it stands now. */
export type StockDay = { day: Date; costCents: number };

/**
 * One entry per day of the period, oldest first; a day with no movements is zeros. The
 * stock series starts from `openingCents` and adds each day's movements to it, so its
 * last day is the statement's closing stock.
 */
export function fillDays(rows: DayRow[], from: Date, days: number, openingCents = 0) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const first = Math.floor(from.getTime() / DAY_MS);
  const sales: SalesDay[] = [];
  const stock: StockDay[] = [];
  let running = openingCents;
  for (let i = 0; i < days; i++) {
    const row = byDay.get(first + i);
    const day = new Date((first + i) * DAY_MS);
    sales.push({ day, units: row?.units ?? 0, valueCents: row?.valueCents ?? 0, costCents: row?.costCents ?? 0 });
    running += row?.stockChangeCents ?? 0;
    stock.push({ day, costCents: running });
  }
  return { sales, stock };
}

/** Units and their value at today's unit cost. */
export type Amount = { units: number; costCents: number };

const amount = (rows: LedgerRow[], units: (r: LedgerRow) => number): Amount => ({
  units: rows.reduce((sum, r) => sum + units(r), 0),
  costCents: rows.reduce((sum, r) => sum + units(r) * r.unitCostCents, 0),
});

/**
 * The period's stock reconciliation. Every line is summed from the ledger; `closing` is
 * opening stock plus every movement since, and `onHand` is the products' own on-hand
 * column, which the database keeps in step with the ledger. The two agreeing is the
 * audit: the page says so, or says by how much they don't.
 */
export function reconcile(rows: LedgerRow[]) {
  const opening = amount(rows, (r) => r.opening);
  const received = amount(rows, (r) => r.received);
  const returned = amount(rows, (r) => r.returned);
  // Sales and write-offs are negative in the ledger; the statement prints them as amounts taken off.
  const sold = amount(rows, (r) => -r.sold);
  const writtenOff = amount(rows, (r) => -r.writtenOff);
  const countFound = amount(rows, (r) => r.countFound);
  const countShort = amount(rows, (r) => -r.countShort);
  const closing = amount(
    rows,
    (r) => r.opening + r.received + r.returned + r.sold + r.writtenOff + r.countFound + r.countShort,
  );
  // On hand includes anything recorded after the period ended (only possible for a past `to`).
  const onHand = amount(rows, (r) => r.onHand - r.after);
  return { opening, received, returned, sold, writtenOff, countFound, countShort, closing, onHand };
}

export type Reconciliation = ReturnType<typeof reconcile>;

/** Days the stock lasts at a rate of `perDay`; null when nothing sold. */
const lasts = (stock: number, perDay: number) => (perDay > 0 ? stock / perDay : null);

/** Sales, margin and stock for each category, biggest sales first; uncategorised products last. */
export function byCategory(rows: LedgerRow[], days: number) {
  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const name = r.category ?? UNCATEGORISED;
    groups.set(name, [...(groups.get(name) ?? []), r]);
  }
  return [...groups]
    .map(([name, members]) => {
      const sales = members.reduce((sum, r) => sum + netSold(r) * r.unitPriceCents, 0);
      const cost = members.reduce((sum, r) => sum + netSold(r) * r.unitCostCents, 0);
      const stockCents = members.reduce((sum, r) => sum + r.onHand * r.unitCostCents, 0);
      return {
        name,
        products: members.length,
        salesCents: sales,
        marginCents: sales - cost,
        stockCents,
        /** How long the category's stock lasts at the period's cost of sales a day. */
        lastsDays: lasts(stockCents, cost / days),
      };
    })
    .sort(
      (a, b) =>
        Number(a.name === UNCATEGORISED) - Number(b.name === UNCATEGORISED) ||
        b.salesCents - a.salesCents ||
        a.name.localeCompare(b.name),
    );
}

/** Units sold less units returned, in the period. */
const netSold = (r: LedgerRow) => -(r.sold + r.returned);

export type ProductFigures = ReturnType<typeof productFigures>;

function productFigures(r: LedgerRow, days: number) {
  const units = netSold(r);
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    netSold: units,
    salesCents: units * r.unitPriceCents,
    onHand: r.onHand,
    stockCents: r.onHand * r.unitCostCents,
    lastsDays: lasts(r.onHand, units / days),
  };
}

/** The products that sold the most by value in the period. */
export function bestSellers(rows: LedgerRow[], days: number) {
  return rows
    .map((r) => productFigures(r, days))
    .filter((p) => p.netSold > 0)
    .sort((a, b) => b.salesCents - a.salesCents || a.name.localeCompare(b.name))
    .slice(0, LIST_LENGTH);
}

/**
 * Active products whose stock lasts longest at the period's sales rate: the stock that
 * ties up the most time on the shelf. Stock that didn't sell at all comes first, by value.
 */
export function slowestSellers(rows: LedgerRow[], days: number) {
  return rows
    .filter((r) => !r.archived && r.onHand > 0)
    .map((r) => productFigures(r, days))
    .sort(
      (a, b) =>
        (b.lastsDays ?? Infinity) - (a.lastsDays ?? Infinity) ||
        b.stockCents - a.stockCents ||
        a.name.localeCompare(b.name),
    )
    .slice(0, LIST_LENGTH);
}

/**
 * What became of everything that was on the shelves in the period (the opening stock and
 * all that came in): sold, written off, missing at a count, or still there. The parts add
 * up to the whole, in units and at cost.
 */
export function whereItWent(stock: Reconciliation) {
  const whole: Amount = {
    units: stock.opening.units + stock.received.units + stock.returned.units + stock.countFound.units,
    costCents:
      stock.opening.costCents + stock.received.costCents + stock.returned.costCents + stock.countFound.costCents,
  };
  return {
    whole,
    parts: [
      { part: "sold", amount: stock.sold },
      { part: "writtenOff", amount: stock.writtenOff },
      { part: "short", amount: stock.countShort },
      { part: "onHand", amount: stock.closing },
    ] as const,
  };
}

/** The orders that arrived in the period, with their supplier and how they were due. */
async function deliveryRows(db: Database, from: Date, to: Date) {
  return db
    .select({
      id: purchaseOrders.id,
      supplierId: suppliers.id,
      supplier: suppliers.name,
      leadTimeDays: suppliers.leadTimeDays,
      orderedAt: purchaseOrders.orderedAt,
      expectedAt: purchaseOrders.expectedAt,
      receivedAt: purchaseOrders.receivedAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(
      and(
        eq(purchaseOrders.status, "received"),
        gte(purchaseOrders.receivedAt, from),
        lt(purchaseOrders.receivedAt, to),
      ),
    )
    .orderBy(asc(purchaseOrders.receivedAt), asc(purchaseOrders.id));
}

/**
 * Each supplier that delivered in the period: how many days every order took, against
 * the lead time they quote now, and whether it arrived by its due day. Shortest lead
 * time first, so the rows climb the shared days axis.
 */
export function supplierDelivery(rows: Awaited<ReturnType<typeof deliveryRows>>) {
  const bySupplier = new Map<
    number,
    {
      id: number;
      name: string;
      leadTimeDays: number;
      deliveries: { id: number; number: string; days: number; onTime: boolean; receivedAt: Date }[];
    }
  >();
  for (const r of rows) {
    if (!r.orderedAt || !r.receivedAt) continue;
    const supplier = bySupplier.get(r.supplierId) ?? {
      id: r.supplierId,
      name: r.supplier,
      leadTimeDays: r.leadTimeDays,
      deliveries: [],
    };
    supplier.deliveries.push({
      id: r.id,
      number: poNumber(r.id),
      days: daysTaken(r.orderedAt, r.receivedAt),
      onTime: arrivedOnTime({ ...r, orderedAt: r.orderedAt, receivedAt: r.receivedAt }),
      receivedAt: r.receivedAt,
    });
    bySupplier.set(r.supplierId, supplier);
  }
  return [...bySupplier.values()]
    .map((s) => ({ ...s, onTime: s.deliveries.filter((d) => d.onTime).length }))
    .sort((a, b) => a.leadTimeDays - b.leadTimeDays || a.name.localeCompare(b.name));
}

export type SupplierDelivery = ReturnType<typeof supplierDelivery>[number];

/** The first entry in the ledger, or null for an empty one. */
async function ledgerStart(db: Database) {
  const [row] = await db.select({ first: sql<number | null>`min(${stockMovements.occurredAt})` }).from(stockMovements);
  return row?.first == null ? null : new Date(Number(row.first));
}

/**
 * Everything the analytics page shows for a period ending at `now`. Money is valued at
 * today's list prices and unit costs: the ledger records units, not the price a sale was
 * made at.
 */
export async function getAnalytics(db: Database, days: PeriodDays, now = new Date()) {
  const { from, to } = periodRange(days, now);
  const [rows, byDay, deliveries, start] = await Promise.all([
    ledgerRows(db, from, to),
    dayRows(db, from, to),
    deliveryRows(db, from, to),
    ledgerStart(db),
  ]);
  const stock = reconcile(rows);
  const { sales: daily, stock: stockByDay } = fillDays(byDay, from, days, stock.opening.costCents);
  const salesCents = daily.reduce((sum, d) => sum + d.valueCents, 0);
  const costCents = daily.reduce((sum, d) => sum + d.costCents, 0);
  return {
    days,
    from,
    to,
    /** The ledger began after the period did, so its opening stock is zero by definition. */
    startsInside: start !== null && start.getTime() > from.getTime(),
    ledgerStart: start,
    sales: {
      units: daily.reduce((sum, d) => sum + d.units, 0),
      valueCents: salesCents,
      marginCents: salesCents - costCents,
      daily,
    },
    stock,
    stockByDay,
    whereItWent: whereItWent(stock),
    deliveries: supplierDelivery(deliveries),
    categories: byCategory(rows, days),
    best: bestSellers(rows, days),
    slowest: slowestSellers(rows, days),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
