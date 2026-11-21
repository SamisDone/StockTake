import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { getStockForecasts } from "@/domain/forecast";
import { getReorderSuggestions } from "@/domain/reorder";
import { demoPasswordHash, demoStatements, resetStatements } from "@/seed/demo";
import { createTestDb } from "@/test/db";
import { TOOL_DEFINITIONS, type ToolOutcome, runTool } from "./tools";

const now = new Date(Date.UTC(2026, 10, 20, 12));
let db: Database;

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  const rules = readFileSync("drizzle/0001_ledger_rules.sql", "utf8");
  const statements = demoStatements({
    anchor: new Date(Date.UTC(2026, 10, 20)),
    passwordHash: await demoPasswordHash(),
  });
  await test.client.executeMultiple([...resetStatements(rules), ...statements].join("\n"));
});

async function ok(name: string, args: unknown = {}): Promise<ToolOutcome & { data: Record<string, unknown> }> {
  const result = await runTool({ db, now }, name, JSON.stringify(args));
  if (!result.ok) throw new Error(`${name} failed: ${result.error}`);
  return result.outcome as ToolOutcome & { data: Record<string, unknown> };
}

const refused = async (name: string, raw: string) => {
  const result = await runTool({ db, now }, name, raw);
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.error;
};

describe("tool definitions", () => {
  it("describe every tool as an object schema, without the JSON Schema dialect", () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual([
      "search_products",
      "get_product",
      "list_suppliers",
      "get_supplier",
      "list_orders",
      "get_order",
      "sales_summary",
      "draft_purchase_order",
    ]);
    for (const t of TOOL_DEFINITIONS) {
      expect(t.type).toBe("function");
      expect(t.function.parameters).toMatchObject({ type: "object" });
      expect(t.function.parameters).not.toHaveProperty("$schema");
    }
    expect(TOOL_DEFINITIONS[0].function.parameters).toMatchObject({
      properties: { status: { enum: ["out", "reorder", "ok"] } },
    });
  });
});

describe("runTool", () => {
  it("refuses unknown tools, broken JSON and arguments outside the schema, as text for the model", async () => {
    expect(await refused("drop_tables", "{}")).toBe("There is no tool called drop_tables.");
    expect(await refused("get_product", "{productId: 1")).toBe("The arguments weren't valid JSON.");
    expect(await refused("get_product", '{"productId":"1; DROP TABLE products"}')).toMatch(
      /^Invalid arguments: productId/,
    );
    expect(await refused("search_products", '{"status":"low"}')).toMatch(/^Invalid arguments: status/);
    expect(await refused("search_products", '{"limit":500}')).toMatch(/^Invalid arguments: limit/);
  });

  it("passes a missing record back as the domain's message", async () => {
    expect(await refused("get_product", '{"productId":9999}')).toBe("That product doesn't exist.");
    expect(await refused("get_order", '{"orderId":9999}')).toBe("That purchase order doesn't exist.");
  });

  it("treats null arguments as left out, and empty arguments as none", async () => {
    const nulls = await runTool({ db, now }, "search_products", '{"query":null,"status":null}');
    const empty = await runTool({ db, now }, "search_products", "");
    expect(nulls.ok && empty.ok).toBe(true);
  });
});

describe("search_products", () => {
  it("lists the most urgent products first when given no filter", async () => {
    const forecasts = await getStockForecasts(db, now);
    const { data, refs } = await ok("search_products");
    expect(data.matched).toBe(30);
    expect(data.shown).toBe(10);
    expect(refs.map((r) => r.id)).toEqual(forecasts.slice(0, 10).map((f) => f.id));
  });

  it("filters by status, and by words that must all match", async () => {
    const out = await ok("search_products", { status: "out" });
    const products = out.data.products as { status: string; onHand: number }[];
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.status === "out of stock" && p.onHand === 0)).toBe(true);

    const [first] = await getStockForecasts(db, now);
    const named = await ok("search_products", { query: first.name.toUpperCase() });
    expect(named.refs[0]).toEqual({ kind: "product", id: first.id, label: first.name, code: first.sku });
    expect((await ok("search_products", { query: "zzz nothing" })).data.matched).toBe(0);
  });

  it("gives money as text and days rounded, so the model repeats rather than computes", async () => {
    const { data } = await ok("search_products", { limit: 1 });
    const [p] = data.products as Record<string, unknown>[];
    expect(p.unitCost).toMatch(/^\$\d/);
    // Dates come as the pages print them, so the model repeats them that way.
    expect(p.runsOutOn === null || /^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/.test(String(p.runsOutOn))).toBe(true);
  });
});

describe("get_product", () => {
  it("returns the stock picture and the latest movements", async () => {
    const [first] = await getStockForecasts(db, now);
    const { data, summary } = await ok("get_product", { productId: first.id });
    const movements = data.latestMovements as { day: string; balanceAfter: number }[];
    expect(data.name).toBe(first.name);
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0].balanceAfter).toBe(first.onHand);
    expect(summary).toContain(first.name);
  });
});

describe("suppliers", () => {
  it("lists every active supplier with its record", async () => {
    const { data, refs } = await ok("list_suppliers");
    expect(refs).toHaveLength(6);
    expect((data.suppliers as Record<string, unknown>[])[0]).toHaveProperty("receivedOnTime");
  });

  it("reads one supplier with its products and open orders", async () => {
    const { data, refs } = await ok("get_supplier", { supplierId: 1 });
    expect(data.name).toBe("Harbor Packaging Co.");
    expect((data.products as unknown[]).length).toBeGreaterThan(0);
    expect(refs[0]).toEqual({ kind: "supplier", id: 1, label: "Harbor Packaging Co." });
  });
});

describe("orders", () => {
  it("lists only late orders: placed and past the due day", async () => {
    const { data } = await ok("list_orders", { late: true });
    for (const o of data.orders as { status: string; late: boolean; daysLate: number }[]) {
      expect(o).toMatchObject({ status: "ordered", late: true });
      expect(o.daysLate).toBeGreaterThan(0);
    }
  });

  it("reads one order with its lines", async () => {
    const { data: list } = await ok("list_orders", { limit: 1 });
    const [{ orderId }] = list.orders as { orderId: number }[];
    const { data, refs } = await ok("get_order", { orderId });
    expect((data.lines as unknown[]).length).toBeGreaterThan(0);
    expect(refs[0]).toMatchObject({ kind: "order", id: orderId, code: data.number });
  });
});

describe("sales_summary", () => {
  it("sums the period's sales with best and slowest sellers", async () => {
    const { data } = await ok("sales_summary", { days: 90 });
    expect([data.from, data.to]).toEqual(["Aug 23", "Nov 20"]);
    expect(data.unitsSold).toBeGreaterThan(0);
    expect((data.bestSellers as unknown[]).length).toBe(5);
    expect(await refused("sales_summary", '{"days":7}')).toMatch(/^Invalid arguments: days/);
  });
});

describe("draft_purchase_order", () => {
  it("proposes the forecast's lines for a supplier, and writes nothing", async () => {
    const { suppliers } = await getReorderSuggestions(db, now);
    const group = suppliers.find((s) => s.lines.some((l) => l.draftId === null))!;
    const { proposal, data } = await ok("draft_purchase_order", { supplierId: group.supplierId });
    const open = group.lines.filter((l) => l.draftId === null);

    expect(data.proposed).toBe(true);
    expect(proposal).toMatchObject({ supplierId: group.supplierId, supplierName: group.supplierName });
    expect(proposal!.lines.map((l) => [l.productId, l.quantity])).toEqual(open.map((l) => [l.productId, l.quantity]));
    expect(proposal!.totalCents).toBe(open.reduce((sum, l) => sum + l.quantity * l.unitCostCents, 0));
    // Asking again proposes the same thing: nothing was drafted.
    expect((await ok("draft_purchase_order", { supplierId: group.supplierId })).proposal).toEqual(proposal);
  });

  it("takes chosen lines, but only the supplier's own products, once each", async () => {
    const forecasts = await getStockForecasts(db, now);
    const mine = forecasts.find((f) => f.supplierId === 1)!;
    const theirs = forecasts.find((f) => f.supplierId !== null && f.supplierId !== 1)!;

    const { proposal } = await ok("draft_purchase_order", {
      supplierId: 1,
      lines: [{ productId: mine.id, quantity: 12 }],
    });
    expect(proposal!.lines).toEqual([
      expect.objectContaining({ productId: mine.id, quantity: 12, unitCostCents: mine.unitCostCents }),
    ]);

    const line = (productId: number) => ({ productId, quantity: 1 });
    expect(await refused("draft_purchase_order", JSON.stringify({ supplierId: 1, lines: [line(theirs.id)] }))).toBe(
      `Harbor Packaging Co. doesn't supply ${theirs.name}.`,
    );
    expect(
      await refused("draft_purchase_order", JSON.stringify({ supplierId: 1, lines: [line(mine.id), line(mine.id)] })),
    ).toBe("Each product can appear on an order once.");
  });
});
