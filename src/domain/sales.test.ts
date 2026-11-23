import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, payments, stockMovements } from "@/db/schema";
import { getAnalytics } from "@/domain/analytics";
import { createCustomer, getCustomer, listCustomers, recordPayment } from "@/domain/customers";
import { getProduct } from "@/domain/products";
import { listMovements, recordCount, undoMovement } from "@/domain/stock";
import { createTestDb, seedDemo } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";
import { allocateNet, getSale, listSales, recordSale, saleFigures, settle, voidSale } from "./sales";

let db: Database;
const NOW = new Date("2026-11-20T08:00:00Z");

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
  await recordCount(db, admin, { productId: 1, counted: 20 }, new Date("2026-11-10T08:00:00Z"));
  await recordCount(db, admin, { productId: 2, counted: 10 }, new Date("2026-11-10T08:00:00Z"));
});

const customer = () => createCustomer(db, staff, { name: "Rahman Traders", phone: "01711 000000" }, NOW);

describe("sharing a sale's discount", () => {
  it("spreads it over the lines by their totals, in whole cents that add up", () => {
    expect(allocateNet([{ grossCents: 1000 }, { grossCents: 500 }], 300)).toEqual([800, 400]);
    expect(allocateNet([{ grossCents: 100 }, { grossCents: 100 }, { grossCents: 100 }], 100)).toEqual([66, 67, 67]);
    expect(allocateNet([{ grossCents: 999 }], 0)).toEqual([999]);
  });

  it("works out a sale's figures from its lines", () => {
    const figures = saleFigures(
      [
        { quantity: 2, unitPriceCents: 900, discountCents: 100 },
        { quantity: 1, unitPriceCents: 1500, discountCents: 0 },
      ],
      300,
    );
    expect(figures).toMatchObject({ subtotalCents: 3200, totalCents: 2900, listCents: 3300 });
    expect(figures.nets.reduce((a, b) => a + b, 0)).toBe(2900);
  });
});

describe("recording a sale", () => {
  it("takes each line's stock, keeps the payment and the due, and logs it", async () => {
    const { id: customerId } = await customer();
    const sale = await recordSale(
      db,
      staff,
      {
        customerId,
        lines: [
          { productId: 1, quantity: 2, unitPriceCents: 900, discountCents: 100 },
          { productId: 2, quantity: 1, unitPriceCents: 1500 },
        ],
        discountCents: 300,
        paidCents: 1000,
        method: "cash",
      },
      NOW,
    );
    expect(sale).toMatchObject({ number: "S-0001", totalCents: 2900, dueCents: 1900 });
    expect((await getProduct(db, 1)).onHand).toBe(18);
    expect((await getProduct(db, 2)).onHand).toBe(9);

    const detail = await getSale(db, sale.id);
    expect(detail).toMatchObject({
      customerName: "Rahman Traders",
      totalCents: 2900,
      paidAtSaleCents: 1000,
      dueCents: 1900,
    });
    expect(detail.lines.map((l) => [l.name, l.quantity, l.netCents])).toEqual([
      ["Widget", 2, 1541],
      ["Gadget", 1, 1359],
    ]);
    const [entry] = (await db.select().from(activityLog)).filter((e) => e.action === "sale.recorded");
    expect(entry.summary).toBe("Sold 2 lines to Rahman Traders for $29.00, $19.00 due");
    expect((await listCustomers(db))[0]).toMatchObject({ boughtCents: 2900, paidCents: 1000, dueCents: 1900 });
  });

  it("makes a walk-in pay in full", async () => {
    const lines = [{ productId: 1, quantity: 1, unitPriceCents: 900 }];
    await expect(recordSale(db, staff, { lines, paidCents: 500, method: "cash" }, NOW)).rejects.toMatchObject({
      said: { key: "walkInPays" },
    });
    const sale = await recordSale(db, staff, { lines, paidCents: 900, method: "mobile" }, NOW);
    expect((await getSale(db, sale.id)).dueCents).toBe(0);
  });

  it("refuses discounts bigger than what they come off, and paying more than the total", async () => {
    const line = { productId: 1, quantity: 1, unitPriceCents: 900 };
    await expect(
      recordSale(db, staff, { lines: [{ ...line, discountCents: 901 }], paidCents: 0, method: "cash" }),
    ).rejects.toMatchObject({ said: { key: "discountTooLarge" }, field: "discount-0" });
    await expect(
      recordSale(db, staff, { lines: [line], discountCents: 901, paidCents: 0, method: "cash" }),
    ).rejects.toMatchObject({ said: { key: "discountTooLarge" }, field: "discount" });
    await expect(recordSale(db, staff, { lines: [line], paidCents: 901, method: "cash" })).rejects.toMatchObject({
      said: { key: "paidTooMuch" },
    });
  });

  it("refuses a line that needs more than is on hand, naming it, and writes nothing", async () => {
    await expect(
      recordSale(db, staff, {
        lines: [
          { productId: 1, quantity: 1, unitPriceCents: 900 },
          { productId: 2, quantity: 11, unitPriceCents: 1500 },
        ],
        paidCents: 17400,
        method: "cash",
      }),
    ).rejects.toMatchObject({ code: "insufficient_stock", field: "quantity-1" });
    expect((await getProduct(db, 1)).onHand).toBe(20);
  });

  it("won't let a quick undo take back a priced sale's line", async () => {
    await recordSale(
      db,
      staff,
      { lines: [{ productId: 1, quantity: 1, unitPriceCents: 900 }], paidCents: 900, method: "cash" },
      NOW,
    );
    const movement = (await db.select().from(stockMovements)).find((m) => m.saleLineId !== null)!;
    await expect(undoMovement(db, staff, movement.id, NOW)).rejects.toMatchObject({ said: { key: "saleLineUndo" } });
  });
});

describe("voiding a sale", () => {
  it("puts the stock back and takes it out of what the customer owes, leaving them in credit", async () => {
    const { id: customerId } = await customer();
    const sale = await recordSale(
      db,
      staff,
      { customerId, lines: [{ productId: 1, quantity: 4, unitPriceCents: 900 }], paidCents: 1000, method: "cash" },
      NOW,
    );
    await expect(voidSale(db, staff, sale.id, NOW)).rejects.toMatchObject({ code: "forbidden" });
    await voidSale(db, admin, sale.id, NOW);
    expect((await getProduct(db, 1)).onHand).toBe(20);
    expect(await getCustomer(db, customerId)).toMatchObject({ boughtCents: 0, paidCents: 1000, dueCents: -1000 });
    expect((await getSale(db, sale.id)).voidedAt).not.toBeNull();
    await expect(voidSale(db, admin, sale.id, NOW)).rejects.toMatchObject({ said: { key: "saleVoided" } });
  });

  it("names the sale on its ledger lines, and on the line that voided it", async () => {
    const sale = await recordSale(
      db,
      staff,
      { lines: [{ productId: 1, quantity: 2, unitPriceCents: 900 }], paidCents: 1800, method: "cash" },
      NOW,
    );
    await voidSale(db, admin, sale.id, NOW);
    const [voiding, sold] = await listMovements(db, 1, { limit: 2 });
    expect(sold).toMatchObject({ kind: "sale", saleId: sale.id, undone: true });
    expect(voiding).toMatchObject({ reversedKind: "sale", saleId: sale.id });
    const [count] = (await listMovements(db, 1)).slice(-1);
    expect(count.saleId).toBeNull();
  });
});

describe("dues and payments", () => {
  it("settles a sale with what was paid at it, then the oldest sale first with the rest", () => {
    const owed = settle(
      [
        { id: 2, totalCents: 500, voided: false, paidAtSaleCents: 500 },
        { id: 1, totalCents: 1000, voided: false, paidAtSaleCents: 0 },
        { id: 3, totalCents: 700, voided: true, paidAtSaleCents: 200 },
        { id: 4, totalCents: 900, voided: false, paidAtSaleCents: 0 },
      ],
      1000,
    );
    // 1,000 later plus 200 paid for the voided sale: sale 1 in full, 200 off sale 4.
    expect([...owed].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 700],
    ]);
  });

  it("takes payments up to what's due, and shows what each sale still owes", async () => {
    const { id: customerId } = await customer();
    const sell = (quantity: number) =>
      recordSale(
        db,
        staff,
        { customerId, lines: [{ productId: 1, quantity, unitPriceCents: 1000 }], paidCents: 0, method: "cash" },
        NOW,
      );
    await sell(1);
    await sell(2);
    await expect(
      recordPayment(db, staff, { customerId, amountCents: 3001, method: "cash" }, NOW),
    ).rejects.toMatchObject({ said: { key: "payMoreThanDue", params: { dueCents: 3000 } } });
    expect(await recordPayment(db, staff, { customerId, amountCents: 1500, method: "mobile" }, NOW)).toEqual({
      name: "Rahman Traders",
      dueCents: 1500,
    });
    expect((await listSales(db)).map((s) => [s.number, s.dueCents])).toEqual([
      ["S-0002", 1500],
      ["S-0001", 0],
    ]);
    expect(await db.select().from(payments)).toHaveLength(1);
    expect((await getCustomer(db, customerId)).payments[0]).toMatchObject({ amountCents: 1500, method: "mobile" });
  });
});

describe("analytics", () => {
  it("values a priced sale at what it sold for, a quick one at list price", async () => {
    await recordSale(
      db,
      staff,
      { lines: [{ productId: 1, quantity: 2, unitPriceCents: 700 }], paidCents: 1400, method: "cash" },
      NOW,
    );
    const analytics = await getAnalytics(db, 28, new Date("2026-11-21T08:00:00Z"));
    expect(analytics.sales).toMatchObject({ units: 2, valueCents: 1400 });
    expect(analytics.best[0]).toMatchObject({ name: "Widget", salesCents: 1400 });
  });

  it("takes a voided sale back out", async () => {
    const sale = await recordSale(
      db,
      staff,
      { lines: [{ productId: 1, quantity: 2, unitPriceCents: 700 }], paidCents: 1400, method: "cash" },
      NOW,
    );
    await voidSale(db, admin, sale.id, NOW);
    const analytics = await getAnalytics(db, 28, new Date("2026-11-21T08:00:00Z"));
    expect(analytics.sales).toMatchObject({ units: 0, valueCents: 0 });
  });
});

describe("the demo's books", () => {
  it("owe on each customer's sales exactly what the customer owes", async () => {
    const test = await createTestDb();
    await seedDemo(test.client, new Date(Date.UTC(2026, 10, 20)));
    const owedBySales = new Map<number, number>();
    for (const sale of await listSales(test.db, { limit: 10_000 })) {
      if (sale.customerId !== null) {
        owedBySales.set(sale.customerId, (owedBySales.get(sale.customerId) ?? 0) + sale.dueCents);
      }
    }
    const customers = await listCustomers(test.db);
    expect(customers.some((c) => c.dueCents > 0)).toBe(true);
    for (const c of customers) expect(owedBySales.get(c.id) ?? 0).toBe(Math.max(c.dueCents, 0));
  });
});
