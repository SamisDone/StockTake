import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, products } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { listMovements, recordCount, recordStockChange } from "@/domain/stock";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 9));

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

async function onHand(productId: number) {
  const [row] = await db.select({ onHand: products.onHand }).from(products).where(eq(products.id, productId));
  return row.onHand;
}

async function lastActivity() {
  const [row] = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(1);
  return row;
}

describe("recordCount", () => {
  it("sets opening stock from a count and logs it", async () => {
    const result = await recordCount(db, admin, { productId: 1, counted: 40 }, at(1));
    expect(result).toEqual({ onHand: 40, difference: 40 });
    expect(await onHand(1)).toBe(40);
    expect(await lastActivity()).toMatchObject({
      userId: 1,
      action: "stock.counted",
      entityType: "product",
      entityId: 1,
      summary: "Counted 40 × Widget (was 0)",
    });
  });

  it("records the difference as an adjustment when the count is off", async () => {
    await recordCount(db, admin, { productId: 1, counted: 40 }, at(1));
    const result = await recordCount(db, staff, { productId: 1, counted: 37, note: "shelf B" }, at(2));
    expect(result).toEqual({ onHand: 37, difference: -3 });
    const [movement] = await listMovements(db, 1);
    expect(movement).toMatchObject({ kind: "adjustment", quantity: -3, balance: 37, note: "shelf B" });
  });

  it("logs a count that matches without writing a movement", async () => {
    await recordCount(db, admin, { productId: 1, counted: 12 }, at(1));
    const result = await recordCount(db, admin, { productId: 1, counted: 12 }, at(2));
    expect(result).toEqual({ onHand: 12, difference: 0 });
    expect(await listMovements(db, 1)).toHaveLength(1);
    expect((await lastActivity()).summary).toBe("Counted 12 × Widget, which matches");
  });

  it("rejects a negative count", async () => {
    await expect(recordCount(db, admin, { productId: 1, counted: -1 })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

describe("recordStockChange", () => {
  beforeEach(async () => {
    await recordCount(db, admin, { productId: 1, counted: 20 }, at(1));
  });

  it("takes sales and write-offs out of stock", async () => {
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 5 }, at(2));
    const result = await recordStockChange(
      db,
      staff,
      { productId: 1, kind: "write_off", quantity: 2, note: "water damage" },
      at(3),
    );
    expect(result.onHand).toBe(13);
    expect((await lastActivity()).summary).toBe("Wrote off 2 × Widget: water damage");
  });

  it("puts returns back into stock", async () => {
    const result = await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 3 }, at(2));
    expect(result.onHand).toBe(23);
    expect((await lastActivity()).summary).toBe("Took back a return of 3 × Widget");
  });

  it("refuses to sell more than is on hand, and records nothing", async () => {
    const before = await lastActivity();
    const attempt = recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 21 }, at(2));
    await expect(attempt).rejects.toBeInstanceOf(DomainError);
    await expect(attempt).rejects.toMatchObject({
      code: "insufficient_stock",
      message: "Only 20 × Widget on hand.",
    });
    expect(await onHand(1)).toBe(20);
    expect((await lastActivity()).id).toBe(before.id);
  });

  it.each([0, -4, 2.5])("rejects a quantity of %s", async (quantity) => {
    await expect(recordStockChange(db, staff, { productId: 1, kind: "sale", quantity })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("does not accept receipts, which only come from purchase orders", async () => {
    await expect(
      recordStockChange(db, staff, { productId: 1, kind: "receipt" as never, quantity: 1 }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("reports a missing product", async () => {
    await expect(recordStockChange(db, staff, { productId: 99, kind: "sale", quantity: 1 })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("refuses stock changes on an archived product", async () => {
    await db
      .update(products)
      .set({ archivedAt: at(2) })
      .where(eq(products.id, 1));
    await expect(recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 1 })).rejects.toMatchObject({
      code: "invalid_state",
    });
  });
});

describe("listMovements", () => {
  it("lists newest first with the balance after each movement", async () => {
    await recordCount(db, admin, { productId: 1, counted: 10 }, at(1));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 4 }, at(2));
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 1 }, at(3));
    await recordStockChange(db, staff, { productId: 2, kind: "return", quantity: 9 }, at(3));

    const movements = await listMovements(db, 1);
    expect(movements.map((m) => [m.kind, m.quantity, m.balance, m.userName])).toEqual([
      ["return", 1, 7, "Sam Okafor"],
      ["sale", -4, 6, "Sam Okafor"],
      ["adjustment", 10, 10, "Ada Lovelace"],
    ]);
    expect(movements[0].occurredAt).toEqual(at(3));
  });

  it("pages back from a cursor with the balance still right", async () => {
    await recordCount(db, admin, { productId: 1, counted: 10 }, at(1));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 4 }, at(2));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 1 }, at(2));
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 1 }, at(3));

    const first = await listMovements(db, 1, { limit: 2 });
    expect(first.map((m) => m.balance)).toEqual([6, 5]);
    const last = first.at(-1)!;
    // The second sale shares its time with the first: the ID breaks the tie.
    const older = await listMovements(db, 1, { limit: 2, before: { occurredAt: last.occurredAt, id: last.id } });
    expect(older.map((m) => [m.quantity, m.balance])).toEqual([
      [-4, 6],
      [10, 10],
    ]);
  });
});
