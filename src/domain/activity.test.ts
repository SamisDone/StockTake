import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { hasActivityBefore, listActivity, listPeople } from "./activity";

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 10, day, hour));
let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
  await db.insert(activityLog).values([
    {
      userId: 2,
      action: "stock.sale",
      entityType: "product",
      entityId: 1,
      summary: "Sold 1 × Widget",
      occurredAt: at(10),
    },
    {
      userId: 1,
      action: "purchase_order.placed",
      entityType: "purchase_order",
      entityId: 1,
      summary: "Placed PO-0001",
      occurredAt: at(12),
    },
    {
      userId: 1,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: 1,
      summary: "Updated Northwind",
      occurredAt: at(14),
    },
    {
      userId: 2,
      action: "stock.counted",
      entityType: "product",
      entityId: 2,
      summary: "Counted 4 × Gadget",
      occurredAt: at(14, 15),
    },
    {
      userId: 1,
      action: "product.created",
      entityType: "product",
      entityId: 2,
      summary: "Added Gadget",
      occurredAt: at(16),
    },
  ]);
});

const summaries = (rows: { summary: string }[]) => rows.map((r) => r.summary);

describe("listActivity", () => {
  it("lists newest first, with who did it", async () => {
    const rows = await listActivity(db);
    expect(summaries(rows)).toEqual([
      "Added Gadget",
      "Counted 4 × Gadget",
      "Updated Northwind",
      "Placed PO-0001",
      "Sold 1 × Widget",
    ]);
    expect(rows[1].userName).toBe("Sam Okafor");
  });

  it("filters by kind of action, by person and by a window of time", async () => {
    expect(summaries(await listActivity(db, { actions: ["stock."] }))).toEqual([
      "Counted 4 × Gadget",
      "Sold 1 × Widget",
    ]);
    expect(summaries(await listActivity(db, { actions: ["product.", "supplier."] }))).toEqual([
      "Added Gadget",
      "Updated Northwind",
    ]);
    expect(summaries(await listActivity(db, { userId: 1, from: at(12), to: at(16) }))).toEqual([
      "Updated Northwind",
      "Placed PO-0001",
    ]);
  });

  it("matches action prefixes literally", async () => {
    expect(await listActivity(db, { actions: ["stock%"] })).toEqual([]);
  });
});

describe("hasActivityBefore", () => {
  it("says whether anything matching happened before a moment", async () => {
    expect(await hasActivityBefore(db, at(11))).toBe(true);
    expect(await hasActivityBefore(db, at(10))).toBe(false);
    expect(await hasActivityBefore(db, at(13), { actions: ["supplier."] })).toBe(false);
    expect(await hasActivityBefore(db, at(13), { userId: 2 })).toBe(true);
  });
});

describe("listPeople", () => {
  it("lists everyone by name", async () => {
    expect(await listPeople(db)).toEqual([
      { id: 1, name: "Ada Lovelace" },
      { id: 2, name: "Sam Okafor" },
    ]);
  });
});
