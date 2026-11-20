import { describe, expect, it } from "vitest";
import { explainStock } from "./explain";

const base = {
  status: "ok" as const,
  onHand: 120,
  onOrder: 0,
  dailyDemand: 3,
  leadTimeDays: 14,
  reorderPoint: 20,
  supplierName: "Northline Electronics",
};

describe("explainStock", () => {
  it("says how long healthy stock lasts against the lead time", () => {
    expect(explainStock(base)).toBe("120 on hand lasts 40 days at 3 a day, past the 14‑day lead time.");
  });

  it("counts stock on order toward cover", () => {
    expect(explainStock({ ...base, status: "reorder", onHand: 20, onOrder: 10, reorderPoint: 5 })).toBe(
      "20 on hand and 10 on order lasts 10 days at 3 a day, short of the 14‑day lead time: a new order wouldn't arrive in time.",
    );
  });

  it("names the reorder point when that is what tripped", () => {
    expect(explainStock({ ...base, status: "reorder", onHand: 18, dailyDemand: 0 })).toBe(
      "18 on hand is at or below the reorder point of 20.",
    );
  });

  it("says plainly when nothing sold", () => {
    expect(explainStock({ ...base, dailyDemand: 0 })).toBe(
      "No sales in the last 28 days, and 120 on hand is above the reorder point of 20.",
    );
  });

  it("separates out of stock with and without an order on the way", () => {
    expect(explainStock({ ...base, status: "out", onHand: 0 })).toBe("None on hand, and none on order.");
    expect(explainStock({ ...base, status: "out", onHand: 0, onOrder: 40, supplierName: null, leadTimeDays: 7 })).toBe(
      "None on hand, and 40 on order not yet received.",
    );
  });
});
