import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import {
  archiveProduct,
  createProduct,
  getProduct,
  listProducts,
  restoreProduct,
  updateProduct,
} from "@/domain/products";
import { cancelOrder, createDraft, placeOrder, poNumber } from "@/domain/purchase-orders";
import { recordStockChange } from "@/domain/stock";
import {
  archiveSupplier,
  createSupplier,
  deleteReview,
  getSupplier,
  listSuppliers,
  restoreSupplier,
  reviewSupplier,
  updateSupplier,
} from "@/domain/suppliers";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

const sprocket = {
  sku: " spr-003 ",
  name: "Sprocket",
  category: "Hardware",
  supplierId: 1,
  unitCostCents: 120,
  unitPriceCents: 450,
  reorderPoint: 25,
  reorderQuantity: 100,
};

describe("products", () => {
  it("creates a product with a normalised SKU and no stock", async () => {
    const { id } = await createProduct(db, admin, sprocket);
    expect(await getProduct(db, id)).toMatchObject({
      sku: "SPR-003",
      name: "Sprocket",
      onHand: 0,
      supplierName: "Northwind Supply",
      archivedAt: null,
    });
  });

  it("is admin-only", async () => {
    await expect(createProduct(db, staff, sprocket)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects a SKU that is taken or malformed", async () => {
    await expect(createProduct(db, admin, { ...sprocket, sku: "wid-001" })).rejects.toMatchObject({
      code: "conflict",
      field: "sku",
    });
    await expect(createProduct(db, admin, { ...sprocket, sku: "has space" })).rejects.toMatchObject({
      code: "invalid_input",
      field: "sku",
    });
  });

  it("rejects an unknown supplier", async () => {
    await expect(createProduct(db, admin, { ...sprocket, supplierId: 99 })).rejects.toMatchObject({
      code: "not_found",
      field: "supplierId",
    });
  });

  it("updates details without touching stock", async () => {
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 5 });
    await updateProduct(db, admin, 1, { ...sprocket, sku: "WID-001", name: "Widget Pro", supplierId: null });
    expect(await getProduct(db, 1)).toMatchObject({ name: "Widget Pro", onHand: 5, supplierName: null });
  });

  it("archives and restores, hiding archived products from the list by default", async () => {
    await archiveProduct(db, admin, 1);
    expect((await listProducts(db)).map((p) => p.sku)).toEqual(["GAD-002"]);
    expect((await listProducts(db, { includeArchived: true })).map((p) => p.sku)).toEqual(["GAD-002", "WID-001"]);
    await restoreProduct(db, admin, 1);
    expect((await listProducts(db)).map((p) => p.sku)).toEqual(["GAD-002", "WID-001"]);
  });

  it("refuses to archive a product on an open order, naming the orders", async () => {
    const lines = [{ productId: 1, quantity: 10 }];
    const first = await createDraft(db, admin, { supplierId: 1, lines });
    await expect(archiveProduct(db, admin, 1)).rejects.toMatchObject({
      code: "invalid_state",
      message: `Widget is on ${poNumber(first.id)}, which is still open. Receive or cancel it first.`,
    });

    const second = await createDraft(db, admin, { supplierId: 1, lines });
    await placeOrder(db, admin, second.id);
    await expect(archiveProduct(db, admin, 1)).rejects.toMatchObject({
      message: `Widget is on ${poNumber(first.id)} and ${poNumber(second.id)}, which are still open. Receive or cancel them first.`,
    });

    await cancelOrder(db, admin, first.id);
    await cancelOrder(db, admin, second.id);
    await archiveProduct(db, admin, 1);
    expect((await getProduct(db, 1)).archivedAt).toBeInstanceOf(Date);
  });

  it("keeps an archived product's stock frozen until it's restored", async () => {
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 5 });
    await archiveProduct(db, admin, 1);
    await expect(recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 1 })).rejects.toMatchObject({
      code: "invalid_state",
    });
    await restoreProduct(db, admin, 1);
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 1 });
    expect((await getProduct(db, 1)).onHand).toBe(4);
  });

  it("searches by name or SKU, case-insensitively", async () => {
    expect((await listProducts(db, { query: "widg" })).map((p) => p.sku)).toEqual(["WID-001"]);
    expect((await listProducts(db, { query: "gad-0" })).map((p) => p.sku)).toEqual(["GAD-002"]);
  });

  it("treats LIKE wildcards and the escape character in a search literally", async () => {
    await createProduct(db, admin, { ...sprocket, sku: "BIN-50", name: "50% off bin!" });
    expect((await listProducts(db, { query: "%" })).map((p) => p.sku)).toEqual(["BIN-50"]);
    expect((await listProducts(db, { query: "bin!" })).map((p) => p.sku)).toEqual(["BIN-50"]);
    // "_" would match any single character if it weren't escaped.
    expect(await listProducts(db, { query: "W_dget" })).toEqual([]);
  });

  it("reports a missing product", async () => {
    await expect(getProduct(db, 99)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("suppliers", () => {
  it("creates and updates a supplier", async () => {
    const { id } = await createSupplier(db, admin, { name: "Acme Parts", email: "orders@acme.test", leadTimeDays: 10 });
    await updateSupplier(db, admin, id, { name: "Acme Parts Ltd", email: "orders@acme.test", leadTimeDays: 12 });
    expect(await getSupplier(db, id)).toMatchObject({ name: "Acme Parts Ltd", leadTimeDays: 12, reviews: [] });
  });

  it("is admin-only to create, edit or archive", async () => {
    await expect(createSupplier(db, staff, { name: "X", leadTimeDays: 1 })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(archiveSupplier(db, staff, 1)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an invalid email or lead time", async () => {
    await expect(
      createSupplier(db, admin, { name: "X", email: "not-an-email", leadTimeDays: 3 }),
    ).rejects.toMatchObject({ code: "invalid_input", field: "email" });
    await expect(createSupplier(db, admin, { name: "X", leadTimeDays: -1 })).rejects.toMatchObject({
      code: "invalid_input",
      field: "leadTimeDays",
    });
  });

  it("averages ratings, one review per person, and lets them revise it", async () => {
    await reviewSupplier(db, admin, 1, { rating: 5, comment: "Always on time" });
    await reviewSupplier(db, staff, 1, { rating: 2 });
    await reviewSupplier(db, staff, 1, { rating: 3, comment: "Packaging improved" });

    const [northwind] = await listSuppliers(db);
    expect(northwind).toMatchObject({ name: "Northwind Supply", reviewCount: 2, averageRating: 4, productCount: 2 });

    const supplier = await getSupplier(db, 1);
    expect(supplier.reviews.map((r) => [r.userName, r.rating, r.comment])).toEqual([
      ["Sam Okafor", 3, "Packaging improved"],
      ["Ada Lovelace", 5, "Always on time"],
    ]);
  });

  it("keeps ratings between 1 and 5 stars", async () => {
    await expect(reviewSupplier(db, staff, 1, { rating: 6 })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("lets a person delete their own review", async () => {
    await reviewSupplier(db, staff, 1, { rating: 4 });
    await deleteReview(db, staff, 1);
    expect((await getSupplier(db, 1)).reviews).toEqual([]);
  });

  it("hides archived suppliers from the list by default", async () => {
    await archiveSupplier(db, admin, 1);
    expect(await listSuppliers(db)).toEqual([]);
    expect(await listSuppliers(db, { includeArchived: true })).toHaveLength(1);
  });

  it("refuses to archive a supplier with open orders, naming them", async () => {
    const draft = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 5 }] });
    const placed = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 2, quantity: 5 }] });
    await placeOrder(db, admin, placed.id);
    await expect(archiveSupplier(db, admin, 1)).rejects.toMatchObject({
      code: "invalid_state",
      message: `Northwind Supply has ${poNumber(draft.id)} and ${poNumber(placed.id)} open. Receive or cancel them first.`,
    });

    await cancelOrder(db, admin, draft.id);
    await cancelOrder(db, admin, placed.id);
    await archiveSupplier(db, admin, 1);
  });

  it("restores an archived supplier, admin-only", async () => {
    await archiveSupplier(db, admin, 1);
    await expect(restoreSupplier(db, staff, 1)).rejects.toMatchObject({ code: "forbidden" });
    await restoreSupplier(db, admin, 1);
    expect((await getSupplier(db, 1)).archivedAt).toBeNull();
  });

  it("won't edit an archived supplier until it's restored", async () => {
    await archiveSupplier(db, admin, 1);
    await expect(updateSupplier(db, admin, 1, { name: "Northwind", leadTimeDays: 3 })).rejects.toMatchObject({
      code: "invalid_state",
      message: "Northwind Supply is archived. Restore it to edit it.",
    });
  });
});
