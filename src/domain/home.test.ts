import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { staffHome } from "@/domain/home";
import { createDraft, placeOrder } from "@/domain/purchase-orders";
import { recordCount, recordStockChange } from "@/domain/stock";
import { addDays, startOfDay } from "@/lib/business-time";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const now = new Date(Date.UTC(2026, 10, 20, 6)); // noon in Dhaka
const today = startOfDay(now);

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

describe("staffHome", () => {
  it("lists late deliveries first, then those due today and tomorrow, and nothing later", async () => {
    const long = addDays(today, -20);
    const late = await createDraft(
      db,
      admin,
      { supplierId: 1, expectedAt: addDays(today, -2), lines: [{ productId: 1, quantity: 5 }] },
      long,
    );
    await placeOrder(db, admin, late.id, long);
    const tomorrow = await createDraft(
      db,
      admin,
      { supplierId: 1, expectedAt: addDays(today, 1), lines: [{ productId: 2, quantity: 5 }] },
      today,
    );
    await placeOrder(db, admin, tomorrow.id, today);
    const later = await createDraft(
      db,
      admin,
      { supplierId: 1, expectedAt: addDays(today, 5), lines: [{ productId: 1, quantity: 5 }] },
      today,
    );
    await placeOrder(db, admin, later.id, today);

    const home = await staffHome(db, 2, now);
    expect(home.deliveries.map((d) => [d.id, d.late, d.daysLate])).toEqual([
      [late.id, true, 2],
      [tomorrow.id, false, 0],
    ]);
  });

  it("lists the shelves not counted in 30 days, never-counted first", async () => {
    await recordCount(db, staff, { productId: 1, counted: 10 }, addDays(today, -40));
    await recordCount(db, staff, { productId: 2, counted: 4 }, addDays(today, -3));
    const home = await staffHome(db, 2, now);
    expect(home.countsDue.map((p) => p.name)).toEqual(["Widget"]);
  });

  it("counts a count that matched, though it wrote no movement", async () => {
    await recordCount(db, staff, { productId: 1, counted: 0 }, addDays(today, -1));
    const home = await staffHome(db, 2, now);
    expect(home.countsDue.map((p) => p.name)).toEqual(["Gadget"]);
  });

  it("lists only what this person recorded today", async () => {
    await recordCount(db, staff, { productId: 1, counted: 10 }, addDays(today, -1));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 2 }, new Date(now.getTime() - 60_000));
    await recordStockChange(db, admin, { productId: 1, kind: "sale", quantity: 1 }, new Date(now.getTime() - 30_000));
    const home = await staffHome(db, 2, now);
    expect(home.today.map((e) => e.action)).toEqual(["stock.sale"]);
  });
});
