import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { products } from "@/db/schema";
import { createDraft, getOrder, placeOrder } from "@/domain/purchase-orders";
import { draftSuggestedOrder, getOrderableProducts, getReorderSuggestions } from "@/domain/reorder";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const now = new Date(Date.UTC(2026, 10, 21, 9));
let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  // Widget (reorder at 10, order 50 at $2.50) and Gadget (reorder at 5, order 20 at
  // $4.00), both from Northwind, both out of stock with no sales: each suggests its
  // reorder quantity.
  await seedBasics(db);
});

describe("getReorderSuggestions", () => {
  it("groups what needs ordering by supplier, with the cost of each order", async () => {
    const { suppliers, unsupplied } = await getReorderSuggestions(db, now);

    expect(unsupplied).toEqual([]);
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0]).toMatchObject({
      supplierId: 1,
      supplierName: "Northwind Supply",
      toDraft: 2,
      totalCents: 20500,
    });
    expect(suppliers[0].lines.map((l) => [l.name, l.quantity, l.draftId])).toEqual([
      ["Gadget", 20, null],
      ["Widget", 50, null],
    ]);
  });

  it("lists products with no supplier apart, since an order needs one", async () => {
    await db.insert(products).values({
      id: 3,
      sku: "LOOSE-1",
      name: "Loose part",
      unitCostCents: 100,
      unitPriceCents: 300,
      reorderPoint: 5,
      reorderQuantity: 12,
    });
    const { unsupplied } = await getReorderSuggestions(db, now);
    expect(unsupplied.map((l) => [l.name, l.quantity])).toEqual([["Loose part", 12]]);
  });

  it("marks a product already on a draft, and leaves it out of the cost", async () => {
    const draft = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 50 }] });
    const [northwind] = (await getReorderSuggestions(db, now)).suppliers;

    expect(northwind.lines.find((l) => l.name === "Widget")?.draftId).toBe(draft.id);
    expect(northwind).toMatchObject({ toDraft: 1, totalCents: 8000 });
  });

  it("drops a product once a placed order covers it", async () => {
    const order = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 50 }] });
    await placeOrder(db, admin, order.id);
    const [northwind] = (await getReorderSuggestions(db, now)).suppliers;
    expect(northwind.lines.map((l) => l.name)).toEqual(["Gadget"]);
  });
});

describe("getOrderableProducts", () => {
  it("lists each supplier's active products, starting at the forecast's quantity", async () => {
    await db.insert(products).values([
      { id: 3, sku: "LOOSE-1", name: "Loose part", unitCostCents: 100, unitPriceCents: 300 },
      {
        id: 4,
        sku: "OLD-1",
        name: "Old part",
        supplierId: 1,
        unitCostCents: 100,
        unitPriceCents: 300,
        archivedAt: now,
      },
    ]);
    const { id } = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 50 }] }, now);
    await placeOrder(db, admin, id, now);

    // Widget is covered by the placed order, so it starts at its reorder quantity instead.
    expect((await getOrderableProducts(db, now)).map((p) => [p.name, p.supplierId, p.suggested, p.quantity])).toEqual([
      ["Gadget", 1, 20, 20],
      ["Widget", 1, 0, 50],
    ]);
  });
});

describe("draftSuggestedOrder", () => {
  it("drafts an order for everything the supplier should send, as the person", async () => {
    const { id } = await draftSuggestedOrder(db, staff, 1, now);
    const order = await getOrder(db, id);

    expect(order).toMatchObject({ status: "draft", supplierId: 1, totalCents: 20500 });
    expect(order.lines.map((l) => [l.name, l.quantity, l.unitCostCents])).toEqual([
      ["Gadget", 20, 400],
      ["Widget", 50, 250],
    ]);
  });

  it("refuses to draft the same suggestions twice", async () => {
    await draftSuggestedOrder(db, staff, 1, now);
    await expect(draftSuggestedOrder(db, staff, 1, now)).rejects.toMatchObject({
      code: "invalid_state",
      message: "Everything Northwind Supply should send is on a draft already.",
    });
  });

  it("says so when a supplier has nothing to order", async () => {
    await expect(draftSuggestedOrder(db, staff, 99, now)).rejects.toMatchObject({
      code: "invalid_state",
      message: "Nothing from that supplier needs ordering right now.",
    });
  });
});
