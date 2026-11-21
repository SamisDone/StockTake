import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { products } from "@/db/schema";
import { getAnalytics, periodRange, readPeriod } from "@/domain/analytics";
import { createDraft, placeOrder, receiveOrder } from "@/domain/purchase-orders";
import { recordCount, recordStockChange } from "@/domain/stock";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const now = new Date(Date.UTC(2026, 10, 29, 12));
const daysAgo = (days: number, hour = 12) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hour));

describe("periods", () => {
  it("reads a period from the URL, falling back to 28 days", () => {
    expect(readPeriod("90")).toBe(90);
    expect(readPeriod("28")).toBe(28);
    expect(readPeriod("7")).toBe(28);
    expect(readPeriod(undefined)).toBe(28);
  });

  it("runs whole UTC days up to now, today included", () => {
    const { from, to } = periodRange(28, now);
    expect(from).toEqual(new Date(Date.UTC(2026, 10, 2)));
    expect(to).toEqual(now);
  });
});

describe("getAnalytics", () => {
  let db: Database;

  /**
   * Widget (cost $2.50, price $9) and Gadget (cost $4, price $15): counted in before the
   * period, then a delivery, sales, a return, a write-off and two counts inside it.
   */
  beforeEach(async () => {
    ({ db } = await createTestDb());
    await seedBasics(db);
    await db.update(products).set({ category: "Tools" }).where(eq(products.id, 1));
    await recordCount(db, staff, { productId: 1, counted: 100 }, daysAgo(40));
    await recordCount(db, staff, { productId: 2, counted: 20 }, daysAgo(40));

    const order = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 50 }] }, daysAgo(14));
    await placeOrder(db, admin, order.id, daysAgo(14));
    await receiveOrder(db, staff, order.id, daysAgo(10));

    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 30 }, daysAgo(5));
    await recordStockChange(db, staff, { productId: 2, kind: "sale", quantity: 5 }, daysAgo(5));
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 2 }, daysAgo(5, 15));
    await recordStockChange(
      db,
      staff,
      { productId: 1, kind: "write_off", quantity: 3, note: "Crushed" },
      daysAgo(5, 16),
    );
    // Widget is at 119 and counts 117; Gadget is at 15 and counts 16.
    await recordCount(db, staff, { productId: 1, counted: 117 }, daysAgo(2));
    await recordCount(db, staff, { productId: 2, counted: 16 }, daysAgo(2));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 4 }, daysAgo(0, 8));
  });

  it("reconciles opening stock and every movement to what's on hand", async () => {
    const { stock, startsInside } = await getAnalytics(db, 28, now);
    expect(stock).toEqual({
      opening: { units: 120, costCents: 100 * 250 + 20 * 400 },
      received: { units: 50, costCents: 50 * 250 },
      returned: { units: 2, costCents: 2 * 250 },
      sold: { units: 39, costCents: 34 * 250 + 5 * 400 },
      writtenOff: { units: 3, costCents: 3 * 250 },
      countFound: { units: 1, costCents: 400 },
      countShort: { units: 2, costCents: 2 * 250 },
      closing: { units: 129, costCents: 113 * 250 + 16 * 400 },
      onHand: { units: 129, costCents: 113 * 250 + 16 * 400 },
    });
    expect(startsInside).toBe(false);
  });

  it("puts everything before the period into its opening stock", async () => {
    const { stock, startsInside } = await getAnalytics(db, 90, now);
    expect(stock.opening.units).toBe(0);
    expect(stock.countFound.units).toBe(121);
    expect(stock.closing).toEqual(stock.onHand);
    expect(startsInside).toBe(true);
  });

  it("leaves out what happened after the period ends", async () => {
    const { stock } = await getAnalytics(db, 28, daysAgo(3));
    // Before the counts two days ago and today's sale: Widget 119, Gadget 15.
    expect(stock.closing.units).toBe(134);
    expect(stock.onHand.units).toBe(134);
    expect(stock.countShort.units).toBe(0);
  });

  it("sums net sales by day at list price, with a zero for each quiet day", async () => {
    const { sales } = await getAnalytics(db, 28, now);
    expect(sales.units).toBe(37);
    expect(sales.valueCents).toBe(32 * 900 + 5 * 1500);
    expect(sales.marginCents).toBe(32 * (900 - 250) + 5 * (1500 - 400));
    expect(sales.daily).toHaveLength(28);
    expect(sales.daily[0].day).toEqual(new Date(Date.UTC(2026, 10, 2)));
    expect(sales.daily.at(-1)).toEqual({ day: daysAgo(0, 0), units: 4, valueCents: 3600, costCents: 1000 });
    expect(sales.daily.at(-6)).toMatchObject({ day: daysAgo(5, 0), units: 33 });
    expect(sales.daily.filter((d) => d.units === 0)).toHaveLength(26);
  });

  it("breaks sales and stock down by category, uncategorised last", async () => {
    const { categories } = await getAnalytics(db, 28, now);
    expect(categories).toEqual([
      {
        name: "Tools",
        products: 1,
        salesCents: 32 * 900,
        marginCents: 32 * 650,
        stockCents: 113 * 250,
        lastsDays: (113 * 250) / ((32 * 250) / 28),
      },
      {
        name: "Uncategorised",
        products: 1,
        salesCents: 5 * 1500,
        marginCents: 5 * 1100,
        stockCents: 16 * 400,
        lastsDays: (16 * 400) / ((5 * 400) / 28),
      },
    ]);
  });

  it("ranks best sellers by value and slowest sellers by how long their stock lasts", async () => {
    const { best, slowest } = await getAnalytics(db, 28, now);
    expect(best.map((p) => [p.name, p.salesCents])).toEqual([
      ["Widget", 28800],
      ["Gadget", 7500],
    ]);
    expect(slowest.map((p) => [p.name, Math.round(p.lastsDays!)])).toEqual([
      ["Widget", 99],
      ["Gadget", 90],
    ]);
  });

  it("puts stock that didn't sell at all first among the slowest", async () => {
    const { slowest } = await getAnalytics(db, 28, daysAgo(6));
    // Six days ago nothing had sold in the period yet: the bigger stock value leads.
    expect(slowest.map((p) => [p.name, p.lastsDays])).toEqual([
      ["Widget", null],
      ["Gadget", null],
    ]);
  });

  it("reports an empty ledger as zeros", async () => {
    const { db: empty } = await createTestDb();
    await seedBasics(empty);
    const analytics = await getAnalytics(empty, 28, now);
    expect(analytics.sales.units).toBe(0);
    expect(analytics.stock.closing).toEqual({ units: 0, costCents: 0 });
    expect(analytics.best).toEqual([]);
    expect(analytics.slowest).toEqual([]);
    expect(analytics.ledgerStart).toBeNull();
  });
});
