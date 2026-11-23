import { asc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "@/db/database";
import { products, stockMovements, suppliers } from "@/db/schema";
import { delimiterOf, readCsv } from "@/lib/csv";
import { parseCents, parseUnits } from "@/lib/parse";
import { logActivity } from "./activity";
import { type Actor, requireAdmin } from "./actor";
import { type Said, isErrorKey, said } from "./error-copy";
import { DomainError, violates } from "./errors";
import { productInput } from "./products";

/**
 * Bringing the catalog in from a spreadsheet: a CSV file with one product per row,
 * matched by SKU. A new SKU adds a product; a known one updates what its row says; an
 * On hand figure is a count, recorded in the ledger like any other. The file is checked
 * first and nothing is written until every row reads; then it all goes in one batch, so
 * an import lands whole or not at all.
 */

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 512 * 1024;

export type ImportColumn =
  | "sku"
  | "name"
  | "category"
  | "supplier"
  | "unitCost"
  | "unitPrice"
  | "reorderPoint"
  | "reorderQuantity"
  | "onHand"
  | "description";

/** The columns the export writes, in its order, under these headers. The import reads the same file back. */
export const PRODUCT_COLUMNS: { key: ImportColumn; header: string }[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "category", header: "Category" },
  { key: "supplier", header: "Supplier" },
  { key: "unitCost", header: "Unit cost (USD)" },
  { key: "unitPrice", header: "Unit price (USD)" },
  { key: "reorderPoint", header: "Reorder at" },
  { key: "reorderQuantity", header: "Reorder quantity" },
  { key: "onHand", header: "On hand" },
  { key: "description", header: "Description" },
];

/** Headers other spreadsheets use for the same thing, compared without case, spaces or punctuation. */
const ALIASES: Record<string, ImportColumn> = {
  sku: "sku",
  code: "sku",
  itemcode: "sku",
  productcode: "sku",
  name: "name",
  product: "name",
  productname: "name",
  item: "name",
  category: "category",
  supplier: "supplier",
  vendor: "supplier",
  unitcostusd: "unitCost",
  unitcost: "unitCost",
  cost: "unitCost",
  costusd: "unitCost",
  unitpriceusd: "unitPrice",
  unitprice: "unitPrice",
  price: "unitPrice",
  priceusd: "unitPrice",
  sellingprice: "unitPrice",
  reorderat: "reorderPoint",
  reorderpoint: "reorderPoint",
  reorderlevel: "reorderPoint",
  reorderquantity: "reorderQuantity",
  reorderqty: "reorderQuantity",
  onhand: "onHand",
  counted: "onHand",
  count: "onHand",
  stock: "onHand",
  description: "description",
};

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** What an update can change, as the preview names it. */
export type ImportField = Exclude<ImportColumn, "sku" | "onHand">;

export type PlannedRow = {
  line: number;
  sku: string;
  name: string;
  action: "create" | "update" | "unchanged";
  /** For an update, each field the row changes. Money in cents, the supplier by name. */
  changes: { field: ImportField; from: string | number | null; to: string | number | null }[];
  /** A count to record: what the ledger says now, and what the file counted. */
  count: { was: number; counted: number } | null;
};

export type ImportProblem = { line: number | null; column: ImportColumn | null; said: Said };

export type ImportPlan = {
  rows: PlannedRow[];
  problems: ImportProblem[];
  /** Suppliers the file names that don't exist yet; the import adds them. */
  newSuppliers: string[];
  /** Headers the import doesn't read, left as they are. */
  ignored: string[];
};

type Values = {
  name: string;
  category: string | null;
  supplier: string | null;
  unitCost: number;
  unitPrice: number;
  reorderPoint: number;
  reorderQuantity: number;
  description: string | null;
};

/** The row write for each planned row, kept beside the plan for `applyImport`. */
type Write = {
  row: PlannedRow;
  values: Values;
  productId: number | null;
  supplierId: number | null;
};

const FIELD_OF_INPUT: Record<string, ImportColumn> = {
  sku: "sku",
  name: "name",
  description: "description",
  category: "category",
  unitCostCents: "unitCost",
  unitPriceCents: "unitPrice",
  reorderPoint: "reorderPoint",
  reorderQuantity: "reorderQuantity",
};

/** Reads and checks the file against the catalog as it is now. Writes nothing. */
export async function planImport(db: Database, text: string): Promise<ImportPlan> {
  return (await prepare(db, text)).plan;
}

async function prepare(db: Database, text: string): Promise<{ plan: ImportPlan; writes: Write[] }> {
  const plan: ImportPlan = { rows: [], problems: [], newSuppliers: [], ignored: [] };
  const writes: Write[] = [];
  const fileProblem = (message: Said) => {
    plan.problems.push({ line: null, column: null, said: message });
    return { plan, writes };
  };

  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) return fileProblem(said("importTooLarge"));
  const [header, ...body] = readCsv(text);
  if (!header) return fileProblem(said("importEmpty"));

  // A file split by semicolons comes from a spreadsheet where the comma is the decimal
  // mark (and a dot or a space groups thousands): 1.234,50 is 1234.50.
  const money =
    delimiterOf(text) === ";" ? (cell: string) => parseCents(cell.replace(/[.\s]/g, "").replace(",", ".")) : parseCents;

  const columns = new Map<ImportColumn, number>();
  header.cells.forEach((cell, index) => {
    const key = ALIASES[headerKey(cell)];
    if (key && !columns.has(key)) columns.set(key, index);
    else if (cell.trim()) plan.ignored.push(cell.trim());
  });
  if (!columns.has("sku")) return fileProblem(said("importNoSku"));
  if (body.length === 0) return fileProblem(said("importEmpty"));
  if (body.length > IMPORT_MAX_ROWS) return fileProblem(said("importTooMany", { max: IMPORT_MAX_ROWS }));

  const [catalog, supplierRows] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        description: products.description,
        supplierId: products.supplierId,
        unitCost: products.unitCostCents,
        unitPrice: products.unitPriceCents,
        reorderPoint: products.reorderPoint,
        reorderQuantity: products.reorderQuantity,
        onHand: products.onHand,
        archivedAt: products.archivedAt,
      })
      .from(products),
    db
      .select({ id: suppliers.id, name: suppliers.name, archivedAt: suppliers.archivedAt })
      .from(suppliers)
      .orderBy(asc(suppliers.id)),
  ]);
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  const supplierById = new Map(supplierRows.map((s) => [s.id, s]));
  const supplierByName = new Map<string, (typeof supplierRows)[number]>();
  for (const s of supplierRows) {
    const key = s.name.trim().toLocaleLowerCase();
    // An active supplier wins over an archived one of the same name.
    if (!supplierByName.has(key) || (supplierByName.get(key)!.archivedAt && !s.archivedAt)) supplierByName.set(key, s);
  }
  const newSuppliers = new Map<string, string>();
  const seen = new Map<string, number>();

  for (const csvRow of body) {
    const problems: ImportProblem[] = [];
    const cell = (key: ImportColumn) => {
      const index = columns.get(key);
      return index === undefined ? "" : (csvRow.cells[index] ?? "").trim();
    };
    const problem = (column: ImportColumn | null, message: Said) =>
      problems.push({ line: csvRow.line, column, said: message });
    const number = (key: ImportColumn, parse: (text: string) => number | null, message: Said) => {
      const text = cell(key);
      if (!text) return undefined;
      const value = parse(text);
      if (value === null) problem(key, message);
      return value ?? undefined;
    };

    const sku = cell("sku").toUpperCase();
    const skuCheck = productInput.shape.sku.safeParse(sku);
    if (!skuCheck.success) {
      problem("sku", messageOf(skuCheck.error.issues[0].message));
      plan.problems.push(...problems);
      continue;
    }
    const earlier = seen.get(sku);
    if (earlier !== undefined) {
      problem("sku", said("importDuplicate", { sku, line: earlier }));
      plan.problems.push(...problems);
      continue;
    }
    seen.set(sku, csvRow.line);

    const existing = bySku.get(sku);
    if (existing?.archivedAt) {
      problem("sku", said("importArchived", { product: existing.name }));
      plan.problems.push(...problems);
      continue;
    }

    const unitCost = number("unitCost", money, said("importMoney"));
    const unitPrice = number("unitPrice", money, said("importMoney"));
    const reorderPoint = number("reorderPoint", parseUnits, said("importUnits"));
    const reorderQuantity = number("reorderQuantity", parseUnits, said("importUnits"));
    const counted = number("onHand", parseUnits, said("importUnits"));

    // The supplier, by name: a known one, or one the import adds.
    let supplierId: number | null = existing?.supplierId ?? null;
    let supplierName: string | null = supplierId ? (supplierById.get(supplierId)?.name ?? null) : null;
    const wanted = cell("supplier");
    if (wanted) {
      const key = wanted.toLocaleLowerCase();
      const known = supplierByName.get(key);
      if (known?.archivedAt) problem("supplier", said("importSupplierArchived", { supplier: known.name }));
      else if (known) {
        supplierId = known.id;
        supplierName = known.name;
      } else {
        if (!newSuppliers.has(key)) newSuppliers.set(key, wanted);
        supplierId = null;
        supplierName = newSuppliers.get(key)!;
      }
    }

    // A blank cell leaves the value as it is; on a new product, empty or zero.
    const values: Values = {
      name: cell("name") || existing?.name || "",
      category: cell("category") || existing?.category || null,
      supplier: supplierName,
      unitCost: unitCost ?? existing?.unitCost ?? 0,
      unitPrice: unitPrice ?? existing?.unitPrice ?? 0,
      reorderPoint: reorderPoint ?? existing?.reorderPoint ?? 0,
      reorderQuantity: reorderQuantity ?? existing?.reorderQuantity ?? 0,
      description: cell("description") || existing?.description || null,
    };
    const check = productInput.safeParse({
      sku,
      name: values.name,
      category: values.category,
      description: values.description,
      unitCostCents: values.unitCost,
      unitPriceCents: values.unitPrice,
      reorderPoint: values.reorderPoint,
      reorderQuantity: values.reorderQuantity,
    });
    if (!check.success) {
      for (const issue of check.error.issues) {
        const column = FIELD_OF_INPUT[String(issue.path[0])] ?? null;
        if (!problems.some((p) => p.column === column)) problem(column, messageOf(issue.message));
      }
    }
    if (problems.length > 0) {
      plan.problems.push(...problems);
      continue;
    }

    const changes: PlannedRow["changes"] = [];
    if (existing) {
      const before: Values = {
        name: existing.name,
        category: existing.category,
        supplier: existing.supplierId ? (supplierById.get(existing.supplierId)?.name ?? null) : null,
        unitCost: existing.unitCost,
        unitPrice: existing.unitPrice,
        reorderPoint: existing.reorderPoint,
        reorderQuantity: existing.reorderQuantity,
        description: existing.description,
      };
      for (const field of Object.keys(values) as ImportField[]) {
        if (values[field] !== before[field]) changes.push({ field, from: before[field], to: values[field] });
      }
    }
    const was = existing?.onHand ?? 0;
    const count = counted !== undefined && counted !== was ? { was, counted } : null;

    const row: PlannedRow = {
      line: csvRow.line,
      sku,
      name: values.name,
      action: existing ? (changes.length > 0 ? "update" : "unchanged") : "create",
      changes,
      count,
    };
    plan.rows.push(row);
    writes.push({ row, values, productId: existing?.id ?? null, supplierId });
  }

  plan.newSuppliers = [...newSuppliers.values()];
  return { plan, writes };
}

const messageOf = (message: string): Said => (isErrorKey(message) ? (said(message) as Said) : said("invalidValue"));

/** How many rows of a plan do what. */
export function importTally(plan: ImportPlan) {
  return {
    created: plan.rows.filter((row) => row.action === "create").length,
    updated: plan.rows.filter((row) => row.action === "update").length,
    unchanged: plan.rows.filter((row) => row.action === "unchanged" && !row.count).length,
    counted: plan.rows.filter((row) => row.count).length,
    suppliers: plan.newSuppliers.length,
  };
}

/**
 * Checks the file again and, if every row reads, writes it all in one atomic batch:
 * new suppliers, new products, updates, then counts, each with its activity entry, as
 * if each had been entered by hand. Admin-only. Returns the plan either way; nothing is
 * written while it has problems.
 */
export async function importProducts(db: Database, actor: Actor, text: string, now = new Date()) {
  requireAdmin(actor, "importProducts");
  const { plan, writes } = await prepare(db, text);
  if (plan.problems.length > 0) return { plan, written: false as const };

  const statements: BatchItem<"sqlite">[] = [];
  for (const name of plan.newSuppliers) {
    statements.push(
      db.insert(suppliers).values({ name, createdAt: now }),
      logActivity(
        db,
        actor,
        {
          action: "supplier.created",
          entityType: "supplier",
          // Inside the atomic batch, the supplier just added is max(id); see createDraft.
          entityId: sql<number>`(SELECT max(${suppliers.id}) FROM ${suppliers})`,
          facts: { name },
        },
        now,
      ),
    );
  }

  const productOf = (sku: string) =>
    sql<number>`(SELECT ${products.id} FROM ${products} WHERE ${products.sku} = ${sku})`;
  for (const { row, values, productId, supplierId } of writes) {
    if (row.action === "unchanged") continue;
    const fields = {
      name: values.name,
      category: values.category,
      description: values.description,
      unitCostCents: values.unitCost,
      unitPriceCents: values.unitPrice,
      reorderPoint: values.reorderPoint,
      reorderQuantity: values.reorderQuantity,
      // A supplier added by this import is found by the name it was given.
      supplierId:
        supplierId ??
        (values.supplier
          ? sql<number>`(SELECT max(${suppliers.id}) FROM ${suppliers} WHERE ${suppliers.name} = ${values.supplier})`
          : null),
    };
    if (row.action === "create") {
      statements.push(
        db.insert(products).values({ sku: row.sku, ...fields, createdAt: now }),
        logActivity(
          db,
          actor,
          {
            action: "product.created",
            entityType: "product",
            entityId: productOf(row.sku),
            facts: { name: values.name, sku: row.sku },
          },
          now,
        ),
      );
    } else {
      statements.push(
        db.update(products).set(fields).where(eq(products.id, productId!)),
        logActivity(
          db,
          actor,
          { action: "product.updated", entityType: "product", entityId: productId!, facts: { name: values.name } },
          now,
        ),
      );
    }
  }

  for (const { row } of writes) {
    if (!row.count) continue;
    // Like a count by hand, the difference is worked out from on hand at write time.
    statements.push(
      db.insert(stockMovements).values({
        productId: productOf(row.sku),
        kind: "adjustment",
        quantity: sql`${row.count.counted} - (SELECT ${products.onHand} FROM ${products} WHERE ${products.sku} = ${row.sku})`,
        userId: actor.id,
        occurredAt: now,
      }),
      logActivity(
        db,
        actor,
        {
          action: "stock.counted",
          entityType: "product",
          entityId: productOf(row.sku),
          facts: { name: row.name, counted: row.count.counted, was: row.count.was },
        },
        now,
      ),
    );
  }

  const [first, ...rest] = statements;
  if (!first) throw new DomainError("invalid_state", said("importNothing"));
  try {
    await db.batch([first, ...rest]);
  } catch (error) {
    // Someone added a SKU, sold or counted stock, or archived something meanwhile.
    if (
      violates(error, "UNIQUE constraint failed: products.sku") ||
      violates(error, "stock_movements_quantity_sign") ||
      violates(error, "CHECK constraint failed") ||
      violates(error, "product is archived")
    ) {
      throw new DomainError("conflict", said("importChanged"));
    }
    throw error;
  }
  return { plan, written: true as const };
}
