import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, products, stockMovements, suppliers } from "@/db/schema";
import { parseCsv, toCsv } from "@/lib/csv";
import { archiveProduct, getProduct } from "@/domain/products";
import { archiveSupplier } from "@/domain/suppliers";
import { recordCount } from "@/domain/stock";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";
import { ledgerRows, orderRows, productRows, supplierRows } from "./exports";
import { IMPORT_MAX_ROWS, importProducts, importTally, planImport } from "./product-import";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

const csv = (...lines: string[]) => lines.join("\n");
const keys = (plan: Awaited<ReturnType<typeof planImport>>) =>
  plan.problems.map((p) => ({ line: p.line, column: p.column, key: p.said.key }));

describe("planning an import", () => {
  it("adds new SKUs, updates known ones, and leaves blank cells as they are", async () => {
    const plan = await planImport(
      db,
      csv(
        "SKU,Name,Category,Supplier,Unit cost (USD),Unit price (USD),Reorder at,Reorder quantity",
        "spr-003,Sprocket,Hardware,Northwind Supply,1.20,4.50,25,100",
        "WID-001,,,,2.75,,,",
        "GAD-002,Gadget,,,,,,",
      ),
    );
    expect(plan.problems).toEqual([]);
    expect(plan.rows.map((row) => [row.line, row.sku, row.action])).toEqual([
      [2, "SPR-003", "create"],
      [3, "WID-001", "update"],
      [4, "GAD-002", "unchanged"],
    ]);
    expect(plan.rows[1].changes).toEqual([{ field: "unitCost", from: 250, to: 275 }]);
    expect(importTally(plan)).toEqual({ created: 1, updated: 1, unchanged: 1, counted: 0, suppliers: 0 });
  });

  it("reads other spreadsheets' headers and lists the columns it doesn't read", async () => {
    const plan = await planImport(db, csv("Item code;Product;Price;Colour", "WID-001;Widget;9,50;Red"));
    expect(plan.problems).toEqual([]);
    expect(plan.ignored).toEqual(["Colour"]);
    expect(plan.rows[0].changes).toEqual([{ field: "unitPrice", from: 900, to: 950 }]);
  });

  it("treats On hand as a count only where it differs from the ledger", async () => {
    await recordCount(db, admin, { productId: 1, counted: 8 });
    const plan = await planImport(db, csv("SKU,On hand", "WID-001,8", "GAD-002,3"));
    expect(plan.rows.map((row) => row.count)).toEqual([null, { was: 0, counted: 3 }]);
  });

  it("names a new supplier once, however many rows use it", async () => {
    const plan = await planImport(
      db,
      csv("SKU,Name,Supplier", "A-1,Alpha,Dhaka Traders", "B-2,Beta,dhaka traders", "WID-001,,northwind supply"),
    );
    expect(plan.newSuppliers).toEqual(["Dhaka Traders"]);
    expect(plan.rows[2].action).toBe("unchanged");
  });

  it("points at each cell it can't read, by line and column", async () => {
    const plan = await planImport(
      db,
      csv(
        "SKU,Name,Unit cost (USD),Reorder at",
        "bad sku!,Thing,1,1",
        "NEW-1,,1,1",
        "NEW-2,Two,twelve,-3",
        "WID-001,Widget,1,1",
        "WID-001,Widget,2,2",
      ),
    );
    expect(keys(plan)).toEqual([
      { line: 2, column: "sku", key: "skuFormat" },
      { line: 3, column: "name", key: "enterName" },
      { line: 4, column: "unitCost", key: "importMoney" },
      { line: 4, column: "reorderPoint", key: "importUnits" },
      { line: 6, column: "sku", key: "importDuplicate" },
    ]);
  });

  it("refuses archived products and archived suppliers", async () => {
    await archiveProduct(db, admin, 2);
    await db.insert(suppliers).values({ id: 2, name: "Old Co" });
    await archiveSupplier(db, admin, 2);
    const plan = await planImport(db, csv("SKU,Name,Supplier", "GAD-002,Gadget,", "NEW-1,New,Old Co"));
    expect(keys(plan)).toEqual([
      { line: 2, column: "sku", key: "importArchived" },
      { line: 3, column: "supplier", key: "importSupplierArchived" },
    ]);
  });

  it("refuses a file with no SKU column, no rows, or too many rows", async () => {
    expect(keys(await planImport(db, "Name\nWidget"))).toEqual([{ line: null, column: null, key: "importNoSku" }]);
    expect(keys(await planImport(db, "SKU,Name\n"))).toEqual([{ line: null, column: null, key: "importEmpty" }]);
    const many = ["SKU", ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `S-${i}`)].join("\n");
    expect(keys(await planImport(db, many))).toEqual([{ line: null, column: null, key: "importTooMany" }]);
  });
});

describe("importing", () => {
  const file = csv(
    "SKU,Name,Category,Supplier,Unit cost (USD),Unit price (USD),On hand",
    "SPR-003,Sprocket,Hardware,Dhaka Traders,1.20,4.50,40",
    "WID-001,Widget,Hardware,,2.75,,12",
  );

  it("writes suppliers, products, updates and counts, each with its activity entry", async () => {
    const result = await importProducts(db, admin, file, new Date("2026-11-20T10:00:00Z"));
    expect(result.written).toBe(true);

    const [sprocket] = await db.select().from(products).where(eq(products.sku, "SPR-003"));
    expect(await getProduct(db, sprocket.id)).toMatchObject({
      name: "Sprocket",
      supplierName: "Dhaka Traders",
      unitCostCents: 120,
      onHand: 40,
    });
    expect(await getProduct(db, 1)).toMatchObject({ category: "Hardware", unitCostCents: 275, onHand: 12 });

    const movements = await db.select().from(stockMovements);
    expect(movements.map((m) => [m.productId, m.kind, m.quantity])).toEqual([
      [sprocket.id, "adjustment", 40],
      [1, "adjustment", 12],
    ]);
    const actions = (await db.select().from(activityLog)).map((entry) => entry.action);
    expect(actions).toEqual([
      "supplier.created",
      "product.created",
      "product.updated",
      "stock.counted",
      "stock.counted",
    ]);
  });

  it("is admin-only", async () => {
    await expect(importProducts(db, staff, file)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("writes nothing while any row has a problem", async () => {
    const result = await importProducts(db, admin, csv("SKU,Name,Unit cost (USD)", "NEW-1,One,1", "NEW-2,,1"));
    expect(result.written).toBe(false);
    expect(await db.select().from(products)).toHaveLength(2);
  });

  it("refuses a file that changes nothing", async () => {
    await expect(importProducts(db, admin, csv("SKU", "WID-001"))).rejects.toMatchObject({
      said: { key: "importNothing" },
    });
  });
});

describe("exports", () => {
  it("writes the catalog under the headers the import reads back unchanged", async () => {
    await recordCount(db, admin, { productId: 1, counted: 5 });
    const rows = await productRows(db);
    expect(rows[0]).toEqual([
      "SKU",
      "Name",
      "Category",
      "Supplier",
      "Unit cost (USD)",
      "Unit price (USD)",
      "Reorder at",
      "Reorder quantity",
      "On hand",
      "Description",
    ]);
    expect(rows[2]).toEqual(["WID-001", "Widget", null, "Northwind Supply", "2.50", "9.00", 10, 50, 5, null]);
    const plan = await planImport(db, toCsv(rows));
    expect(plan.problems).toEqual([]);
    expect(importTally(plan)).toMatchObject({ created: 0, updated: 0, counted: 0 });
  });

  it("writes suppliers with their rating and products", async () => {
    expect(await supplierRows(db)).toEqual([
      ["Name", "Email", "Phone", "Lead time (days)", "Products", "Rating", "Reviews", "Archived on"],
      ["Northwind Supply", null, null, 7, 2, null, 0, null],
    ]);
  });

  it("writes the ledger with each product's balance, on the business's clock", async () => {
    await recordCount(db, admin, { productId: 1, counted: 5 }, new Date("2026-11-01T20:30:00Z"));
    await recordCount(db, admin, { productId: 1, counted: 3 }, new Date("2026-11-02T04:00:00Z"));
    await recordCount(db, admin, { productId: 2, counted: 7 }, new Date("2026-11-02T05:00:00Z"));
    const rows = await ledgerRows(db, new Date("2026-11-01T22:00:00Z"), new Date("2026-11-03T00:00:00Z"));
    expect(rows.slice(1).map((row) => [row[1], row[2], row[3], row[5], row[6], row[7], row[9]])).toEqual([
      ["2026-11-02", "10:00", "WID-001", "Count", -2, 3, "Ada Lovelace"],
      ["2026-11-02", "11:00", "GAD-002", "Count", 7, 7, "Ada Lovelace"],
    ]);
  });

  it("writes orders one line per row", async () => {
    expect((await orderRows(db)).length).toBe(1);
    expect(parseCsv(toCsv(await orderRows(db)))[0][0]).toBe("Order");
  });
});
