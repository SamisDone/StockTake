import { asc, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { activityLog, products } from "@/db/schema";
import { addDays, startOfDay } from "@/lib/business-time";
import { listActivity } from "./activity";
import { daysLate, isLate, listOrders } from "./purchase-orders";
import { listSuppliers } from "./suppliers";
import { outer } from "./input";

/** How often every product's shelf should be counted. */
export const COUNT_EVERY_DAYS = 30;

/**
 * What a person in the stockroom does next: the deliveries to receive (late ones first,
 * with the supplier's phone, then what's due today and tomorrow), the shelves due a
 * count, and what they've recorded today. Days are the business's (Dhaka) days.
 */
export async function staffHome(db: Database, userId: number, now = new Date()) {
  const today = startOfDay(now);
  const afterTomorrow = addDays(today, 2);
  const countedBefore = addDays(today, -COUNT_EVERY_DAYS);

  const lastCounted = sql<number | null>`(
    SELECT max(${activityLog.occurredAt}) FROM ${activityLog}
    WHERE ${activityLog.action} = 'stock.counted' AND ${activityLog.entityType} = 'product'
      AND ${activityLog.entityId} = ${outer(products, "id")}
  )`;

  const [placed, suppliers, shelf, mine] = await Promise.all([
    listOrders(db, { status: "ordered" }),
    listSuppliers(db, { includeArchived: true }),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        category: products.category,
        onHand: products.onHand,
        lastCountedAt: lastCounted,
      })
      .from(products)
      .where(isNull(products.archivedAt))
      .orderBy(sql`${lastCounted} IS NOT NULL`, asc(lastCounted), asc(products.name)),
    listActivity(db, { userId, from: today, limit: 100 }),
  ]);

  const phones = new Map(suppliers.map((s) => [s.id, s.phone]));
  const deliveries = placed
    .filter((o) => o.dueAt !== null && (isLate(o, now) || o.dueAt.getTime() < afterTomorrow.getTime()))
    .map((o) => ({
      id: o.id,
      number: o.number,
      supplierName: o.supplierName,
      phone: phones.get(o.supplierId) ?? null,
      dueAt: o.dueAt!,
      late: isLate(o, now),
      daysLate: daysLate(o, now),
      lines: o.lineCount,
    }))
    .sort((a, b) => Number(b.late) - Number(a.late) || a.dueAt.getTime() - b.dueAt.getTime());

  const countsDue = shelf
    .filter((p) => p.lastCountedAt === null || p.lastCountedAt < countedBefore.getTime())
    .map((p) => ({ ...p, lastCountedAt: p.lastCountedAt === null ? null : new Date(p.lastCountedAt) }));

  return { deliveries, countsDue, today: mine };
}

export type StaffHome = Awaited<ReturnType<typeof staffHome>>;
