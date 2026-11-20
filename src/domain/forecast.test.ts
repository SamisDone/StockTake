import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { forecast, getProductForecast, getStockForecasts } from "@/domain/forecast";
import { archiveProduct } from "@/domain/products";
import { createDraft, placeOrder } from "@/domain/purchase-orders";
import { recordCount, recordStockChange } from "@/domain/stock";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(Date.UTC(2026, 10, 29, 12));
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

const base = { onHand: 100, onOrder: 0, dailyDemand: 2, leadTimeDays: 7, reorderPoint: 10, reorderQuantity: 50 };

describe("forecast", () => {
  it("computes days of cover and the stockout date from daily demand", () => {
    const result = forecast(base, now);
    expect(result.daysOfCover).toBe(50);
    expect(result.stockoutAt).toEqual(new Date(now.getTime() + 50 * DAY));
    expect(result.status).toBe("ok");
    expect(result.suggestedQuantity).toBe(0);
  });

  it("has no stockout date when nothing sells", () => {
    expect(forecast({ ...base, dailyDemand: 0 }, now)).toMatchObject({
      daysOfCover: null,
      stockoutAt: null,
      status: "ok",
    });
  });

  it("flags a reorder when stock won't outlast the supplier's lead time", () => {
    const result = forecast({ ...base, onHand: 12 }, now);
    expect(result.status).toBe("reorder");
    // Cover lead time + 30 days: 2 × 37 = 74, minus the 12 on hand.
    expect(result.suggestedQuantity).toBe(62);
  });

  it("flags a reorder at or below the reorder point, even with no demand", () => {
    const result = forecast({ ...base, onHand: 10, dailyDemand: 0 }, now);
    expect(result.status).toBe("reorder");
    expect(result.suggestedQuantity).toBe(50);
  });

  it("counts stock already on order", () => {
    expect(forecast({ ...base, onHand: 12, onOrder: 80 }, now).status).toBe("ok");
  });

  it("orders at least the product's reorder quantity", () => {
    // 0.5 × 37 = 19 needed, minus 3 on hand = 16, below the reorder quantity.
    expect(forecast({ ...base, onHand: 3, dailyDemand: 0.5, reorderQuantity: 40 }, now).suggestedQuantity).toBe(40);
  });

  it("marks a product with nothing on hand as out", () => {
    expect(forecast({ ...base, onHand: 0 }, now)).toMatchObject({ status: "out", daysOfCover: 0 });
  });
});

describe("getStockForecasts", () => {
  let db: Database;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    await seedBasics(db);
  });

  it("forecasts from the last 28 days of sales net of returns, plus open orders", async () => {
    await recordCount(db, admin, { productId: 1, counted: 100 }, daysAgo(60));
    await recordCount(db, admin, { productId: 2, counted: 30 }, daysAgo(60));
    // Older than the window: ignored.
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 40 }, daysAgo(40));
    // Inside the window: 56 sold, 14 returned, so 42 / 28 = 1.5 a day.
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 56 }, daysAgo(10));
    await recordStockChange(db, staff, { productId: 1, kind: "return", quantity: 14 }, daysAgo(5));
    // Gadget sells 1 a day; 2 on hand plus 3 on order sits at its reorder point of 5.
    await recordStockChange(db, staff, { productId: 2, kind: "sale", quantity: 28 }, daysAgo(3));
    const { id } = await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 2, quantity: 3 }] }, daysAgo(2));
    await placeOrder(db, admin, id, daysAgo(2));

    const forecasts = await getStockForecasts(db, now);
    const widget = forecasts.find((f) => f.sku === "WID-001");
    const gadget = forecasts.find((f) => f.sku === "GAD-002");

    expect(widget).toMatchObject({ onHand: 18, onOrder: 0, dailyDemand: 1.5, daysOfCover: 12, status: "ok" });
    expect(gadget).toMatchObject({ onHand: 2, onOrder: 3, dailyDemand: 1, status: "reorder" });
    // Most urgent first.
    expect(forecasts.map((f) => f.sku)).toEqual(["GAD-002", "WID-001"]);
  });
});

describe("getProductForecast", () => {
  let db: Database;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    await seedBasics(db);
  });

  it("forecasts one product with its prices, archived or not", async () => {
    await recordCount(db, admin, { productId: 1, counted: 56 }, daysAgo(60));
    await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 28 }, daysAgo(10));
    await archiveProduct(db, admin, 1, daysAgo(1));

    expect(await getProductForecast(db, 1, now)).toMatchObject({
      sku: "WID-001",
      supplierName: "Northwind Supply",
      onHand: 28,
      dailyDemand: 1,
      daysOfCover: 28,
      unitPriceCents: 900,
      archivedAt: daysAgo(1),
    });
    // The list leaves archived products out.
    expect((await getStockForecasts(db, now)).map((f) => f.id)).toEqual([2]);
  });

  it("says when the product doesn't exist", async () => {
    await expect(getProductForecast(db, 99, now)).rejects.toMatchObject({ code: "not_found" });
  });
});
