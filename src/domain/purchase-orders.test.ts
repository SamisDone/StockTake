import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, products, suppliers } from "@/db/schema";
import {
  cancelOrder,
  closeOrderShort,
  createDraft,
  daysLate,
  deliveryRecord,
  isLate,
  getOrder,
  listOrders,
  placeOrder,
  poNumber,
  receiveOrder,
  returnToSupplier,
  updateDraft,
} from "@/domain/purchase-orders";
import { getAnalytics } from "@/domain/analytics";
import { getProductForecast } from "@/domain/forecast";
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

  it("only takes products the supplier sells", async () => {
    await db.insert(suppliers).values({ id: 2, name: "Copperleaf Tools", leadTimeDays: 5 });
    await expect(createDraft(db, staff, { ...twoLines, supplierId: 2 })).rejects.toMatchObject({
      code: "invalid_state",
      message: "Copperleaf Tools doesn't supply Widget.",
    });
  });

  it("takes an expected date from the day it's drafted on in Dhaka, not before", async () => {
    // 23:00 on the 5th in Dhaka; the 5th began at 18:00 UTC on the 4th.
    const draftedOn = new Date("2026-11-05T17:00:00Z");
    const sameDay = new Date("2026-11-04T18:00:00Z");
    const { id } = await createDraft(db, staff, { ...twoLines, expectedAt: sameDay }, draftedOn);
    expect((await getOrder(db, id)).expectedAt).toEqual(sameDay);

    await expect(
      createDraft(db, staff, { ...twoLines, expectedAt: new Date("2026-11-03T18:00:00Z") }, draftedOn),
    ).rejects.toMatchObject({
      code: "invalid_input",
      field: "expectedAt",
      message: "The expected date can't be before today.",
    });
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

  it("sets and clears the expected date", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await updateDraft(db, staff, id, { ...twoLines, expectedAt: at(9) }, at(2));
    expect((await getOrder(db, id)).expectedAt).toEqual(at(9));
    await updateDraft(db, staff, id, twoLines, at(3));
    expect((await getOrder(db, id)).expectedAt).toBeNull();
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

describe("receiving in parts", () => {
  async function placed() {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    return getOrder(db, id);
  }

  it("books what came, keeps the order placed until the rest comes, then receives it", async () => {
    const order = await placed();
    const [widgets, gadgets] = order.lines;
    const first = await receiveOrder(db, staff, order.id, at(5), [
      { lineId: widgets.id, quantity: 12 },
      { lineId: gadgets.id, quantity: 0 },
    ]);
    expect(first).toEqual({ complete: false, units: 12 });
    expect(await onHand(1)).toBe(12);
    let now = await getOrder(db, order.id);
    expect(now.status).toBe("ordered");
    expect(now.lines.map((l) => l.received)).toEqual([12, 0]);
    expect(await lastSummary()).toBe("Received part of PO-0001 from Northwind Supply: 12 units");
    expect((await listOrders(db))[0]).toMatchObject({
      orderedUnits: 40,
      receivedUnits: 12,
      dueCents: 18 * 250 + 10 * 380,
    });
    // On order is what's still to come, so the 12 that came in aren't counted twice.
    expect((await getProductForecast(db, 1, at(5))).onOrder).toBe(18);

    // Without quantities: everything still due.
    expect(await receiveOrder(db, staff, order.id, at(7))).toEqual({ complete: true, units: 28 });
    now = await getOrder(db, order.id);
    expect(now.status).toBe("received");
    expect(now.lines.map((l) => l.received)).toEqual([30, 10]);
  });

  it("refuses more than is still due, and a delivery of nothing", async () => {
    const order = await placed();
    const [widgets] = order.lines;
    await receiveOrder(db, staff, order.id, at(5), [{ lineId: widgets.id, quantity: 25 }]);
    await expect(receiveOrder(db, staff, order.id, at(6), [{ lineId: widgets.id, quantity: 6 }])).rejects.toMatchObject(
      { message: "Only 5 more of Widget is due on this order.", field: `receive-${widgets.id}` },
    );
    await expect(receiveOrder(db, staff, order.id, at(6), [{ lineId: widgets.id, quantity: 0 }])).rejects.toMatchObject(
      {
        message: "Enter how many came in for at least one line.",
      },
    );
  });

  it("lets an admin close a partly received order short, and only then", async () => {
    const order = await placed();
    await expect(closeOrderShort(db, admin, order.id, at(6))).rejects.toMatchObject({
      message: "Nothing has come in on PO-0001 yet. If it isn't coming, cancel it instead.",
    });
    await receiveOrder(db, staff, order.id, at(5), [{ lineId: order.lines[0].id, quantity: 30 }]);
    await expect(closeOrderShort(db, staff, order.id, at(6))).rejects.toMatchObject({ code: "forbidden" });
    expect(await closeOrderShort(db, admin, order.id, at(6))).toEqual({ short: 10 });
    const closed = await getOrder(db, order.id);
    expect(closed.status).toBe("received");
    expect(closed.receivedAt).toEqual(at(6));
    expect(await lastSummary()).toBe("Closed PO-0001 from Northwind Supply short: 10 units never came");
  });
});

describe("returnToSupplier", () => {
  it("sends stock back against its line, no more than it received, and the books still balance", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    await receiveOrder(db, staff, id, at(5));
    const [widgets, gadgets] = (await getOrder(db, id)).lines;

    expect(await returnToSupplier(db, staff, { lineId: widgets.id, quantity: 4, note: "Crushed" }, at(6))).toEqual({
      name: "Widget",
      quantity: 4,
      order: "PO-0001",
    });
    expect(await onHand(1)).toBe(26);
    expect(await lastSummary()).toBe("Sent 4 × Widget back to Northwind Supply on PO-0001: Crushed");
    expect((await getOrder(db, id)).lines[0].returned).toBe(4);

    await expect(returnToSupplier(db, staff, { lineId: widgets.id, quantity: 27 }, at(6))).rejects.toMatchObject({
      message: "Only 26 of Widget came in on this order and can go back.",
      field: "quantity",
    });
    await returnToSupplier(db, staff, { lineId: gadgets.id, quantity: 10 }, at(6));
    await expect(returnToSupplier(db, staff, { lineId: gadgets.id, quantity: 1 }, at(6))).rejects.toMatchObject({
      message: "None of Gadget on this order is left to send back.",
    });

    const { stock } = await getAnalytics(db, 28, at(7));
    expect(stock.sentBack.units).toBe(14);
    expect(stock.closing).toEqual(stock.onHand);
  });

  it("refuses a line nothing has come in on", async () => {
    const { id } = await createDraft(db, staff, twoLines, at(1));
    await placeOrder(db, admin, id, at(2));
    const [widgets] = (await getOrder(db, id)).lines;
    await expect(returnToSupplier(db, staff, { lineId: widgets.id, quantity: 1 }, at(3))).rejects.toMatchObject({
      message: "Nothing has been received on PO-0001, so nothing can go back on it.",
    });
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

describe("listOrders by supplier", () => {
  it("lists only that supplier's orders", async () => {
    await db.insert(suppliers).values({ id: 2, name: "Copperleaf Tools", leadTimeDays: 5 });
    await db
      .insert(products)
      .values({ id: 3, sku: "SAW-1", name: "Saw", supplierId: 2, unitCostCents: 900, unitPriceCents: 2000 });
    await createDraft(db, staff, twoLines, at(1));
    const { id } = await createDraft(db, staff, { supplierId: 2, lines: [{ productId: 3, quantity: 2 }] }, at(2));
    expect((await listOrders(db, { supplierId: 2 })).map((o) => o.id)).toEqual([id]);
  });
});

describe("isLate", () => {
  // Due on the 8th: the 8th runs from 18:00 UTC on the 7th to 18:00 UTC on the 8th.
  const order = { dueAt: new Date("2026-11-07T18:00:00Z") };

  it("isn't late on its due day, however late in the day", () => {
    expect(isLate(order, new Date("2026-11-08T17:59:00Z"))).toBe(false);
    expect(daysLate(order, new Date("2026-11-08T17:59:00Z"))).toBe(0);
  });

  it("is late from midnight in Dhaka after the due day, counted in whole days", () => {
    expect(isLate(order, new Date("2026-11-08T18:00:00Z"))).toBe(true);
    expect(daysLate(order, new Date("2026-11-08T18:00:00Z"))).toBe(1);
    expect(daysLate(order, new Date("2026-11-11T09:00:00Z"))).toBe(3);
  });

  it("is never late without a due day", () => {
    expect(isLate({ dueAt: null }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

describe("deliveryRecord", () => {
  it("counts received orders that arrived by their due day", async () => {
    // Placed on the 1st with a 7-day lead time: due the 8th unless the supplier gave a date.
    const receive = async (receivedDay: number, expectedAt?: Date) => {
      const { id } = await createDraft(db, staff, { ...twoLines, expectedAt }, at(1));
      await placeOrder(db, admin, id, at(1));
      // 23:00 in Dhaka: the last hour of the day.
      await receiveOrder(db, staff, id, new Date(Date.UTC(2026, 10, receivedDay, 17)));
    };
    await receive(8); // on the due day, late in the day: on time
    await receive(9); // a day late
    await receive(4, at(3)); // a day after the date they gave
    const cancelled = await createDraft(db, staff, twoLines, at(1));
    await cancelOrder(db, admin, cancelled.id, at(2));

    expect(deliveryRecord(await listOrders(db, { supplierId: 1 }))).toEqual({ received: 3, onTime: 1 });
  });
});
