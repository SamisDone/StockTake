import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, products, suppliers } from "@/db/schema";
import {
  cancelOrder,
  createDraft,
  getOrder,
  listOrders,
  placeOrder,
  poNumber,
  receiveOrder,
  updateDraft,
} from "@/domain/purchase-orders";
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

async function lastSummary() {
  const [row] = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(1);
  return row?.summary;
}

const twoLines = {
  supplierId: 1,
  lines: [
    { productId: 1, quantity: 30 },
    { productId: 2, quantity: 10, unitCostCents: 380 },
  ],
};

describe("poNumber", () => {
  it("pads the ID to four digits", () => {
    expect(poNumber(7)).toBe("PO-0007");
    expect(poNumber(12345)).toBe("PO-12345");
  });
});

describe("createDraft", () => {
  it("creates a draft, defaulting each line to the product's unit cost", async () => {
    const { id } = await createDraft(db, staff, { ...twoLines, notes: "Before the holidays" }, at(1));
    const order = await getOrder(db, id);
    expect(order).toMatchObject({
      id,
      number: "PO-0001",
      status: "draft",
      supplierName: "Northwind Supply",
      notes: "Before the holidays",
      totalCents: 30 * 250 + 10 * 380,
      createdByName: "Sam Okafor",
    });
    expect(order.lines.map((l) => [l.sku, l.quantity, l.unitCostCents, l.lineTotalCents])).toEqual([
      ["WID-001", 30, 250, 7500],
      ["GAD-002", 10, 380, 3800],
    ]);
    expect(await lastSummary()).toBe("Drafted an order with Northwind Supply: 2 lines, $113.00");
  });

  it("gives consecutive drafts their own lines", async () => {
    const first = await createDraft(db, staff, twoLines, at(1));
    const second = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 5 }] }, at(2));
    expect((await getOrder(db, first.id)).lines).toHaveLength(2);
    expect((await getOrder(db, second.id)).lines).toHaveLength(1);
  });

  it("needs at least one line", async () => {
    await expect(createDraft(db, staff, { supplierId: 1, lines: [] })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("rejects the same product twice", async () => {
    await expect(
      createDraft(db, staff, {
        supplierId: 1,
        lines: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid_input", message: "Each product can appear on an order once." });
  });

  it("rejects an unknown product or supplier", async () => {
    await expect(
      createDraft(db, staff, { supplierId: 1, lines: [{ productId: 99, quantity: 1 }] }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(createDraft(db, staff, { ...twoLines, supplierId: 99 })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("rejects an archived supplier", async () => {
    await db
      .update(suppliers)
      .set({ archivedAt: at(1) })
      .where(eq(suppliers.id, 1));
    await expect(createDraft(db, staff, twoLines)).rejects.toMatchObject({ code: "invalid_state" });
  });
});

describe("updateDraft", () => {
  it("replaces the lines and notes of a draft", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await updateDraft(db, staff, id, { supplierId: 1, notes: "Rush", lines: [{ productId: 2, quantity: 4 }] }, at(2));
    const order = await getOrder(db, id);
    expect(order.notes).toBe("Rush");
    expect(order.lines.map((l) => [l.sku, l.quantity])).toEqual([["GAD-002", 4]]);
  });

  it("refuses once the order is placed", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    await expect(
      updateDraft(db, staff, id, { supplierId: 1, lines: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toMatchObject({ code: "invalid_state", message: "PO-0001 has been placed, so it can't be edited." });
  });
});

describe("placeOrder", () => {
  it("lets an admin place a draft", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    const order = await getOrder(db, id);
    expect(order.status).toBe("ordered");
    expect(order.orderedAt).toEqual(at(2));
    expect(await lastSummary()).toBe("Placed PO-0001 with Northwind Supply for $113.00");
  });

  it("is admin-only, because it commits spending", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await expect(placeOrder(db, staff, id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("can't place an order twice", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    await expect(placeOrder(db, admin, id)).rejects.toMatchObject({
      code: "invalid_state",
      message: "PO-0001 has been placed already.",
    });
  });

  it("reports a missing order", async () => {
    await expect(placeOrder(db, admin, 42)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("cancelOrder", () => {
  it("cancels a draft or a placed order, but not a received one", async () => {
    const draft = await createDraft(db, staff, twoLines, at(1));
    await cancelOrder(db, admin, draft.id, at(2));
    expect((await getOrder(db, draft.id)).status).toBe("cancelled");

    const placed = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, placed.id, at(2));
    await cancelOrder(db, admin, placed.id, at(3));
    expect(await lastSummary()).toBe("Cancelled PO-0002");

    const received = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, received.id, at(2));
    await receiveOrder(db, staff, received.id, at(3));
    await expect(cancelOrder(db, admin, received.id)).rejects.toMatchObject({
      code: "invalid_state",
      message: "PO-0003 has been received, so it can't be cancelled.",
    });
  });

  it("is admin-only", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await expect(cancelOrder(db, staff, id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("receiveOrder", () => {
  it("books every line into stock and marks the order received", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    await receiveOrder(db, staff, id, at(9));
    expect(await onHand(1)).toBe(30);
    expect(await onHand(2)).toBe(10);
    const order = await getOrder(db, id);
    expect(order.status).toBe("received");
    expect(order.receivedAt).toEqual(at(9));
    expect(await lastSummary()).toBe("Received PO-0001 from Northwind Supply: 40 units");
  });

  it("refuses an order that hasn't been placed", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await expect(receiveOrder(db, staff, id)).rejects.toMatchObject({
      code: "invalid_state",
      message: "PO-0001 hasn't been placed yet.",
    });
  });

  it("receives an order once, even when two people receive it at the same time", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    const results = await Promise.allSettled([receiveOrder(db, staff, id, at(9)), receiveOrder(db, admin, id, at(9))]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ code: "invalid_state", message: "PO-0001 has been received already." });
    expect(await onHand(1)).toBe(30);
    expect(await onHand(2)).toBe(10);
  });
});

describe("listOrders", () => {
  it("lists newest first with supplier, line count and total, optionally by status", async () => {
    const first = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, first.id, at(2));
    await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 2 }] }, at(3));

    const all = await listOrders(db);
    expect(all.map((o) => [o.number, o.status, o.lineCount, o.totalCents, o.supplierName])).toEqual([
      ["PO-0002", "draft", 1, 500, "Northwind Supply"],
      ["PO-0001", "ordered", 2, 11300, "Northwind Supply"],
    ]);
    expect((await listOrders(db, { status: "ordered" })).map((o) => o.number)).toEqual(["PO-0001"]);
  });

  it("says when a placed order is due: its expected date, else placed plus the supplier's lead time", async () => {
    const plain = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, plain.id, at(2));
    const promised = await createDraft(db, staff, { ...twoLines, expectedAt: at(20) }, at(3));
    await placeOrder(db, admin, promised.id, at(4));
    await createDraft(db, staff, twoLines, at(5));

    const due = Object.fromEntries((await listOrders(db)).map((o) => [o.number, o.dueAt]));
    // Northwind's lead time is 7 days.
    expect(due).toEqual({ "PO-0001": at(9), "PO-0002": at(20), "PO-0003": null });
    expect((await getOrder(db, plain.id)).dueAt).toEqual(at(9));
  });
});
