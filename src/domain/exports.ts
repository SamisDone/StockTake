import { asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Database } from "@/db/database";
import {
  type MovementKind,
  customers,
  products,
  purchaseOrderLines,
  purchaseOrders,
  saleLines,
  sales,
  stockMovements,
  supplierReviews,
  suppliers,
  users,
} from "@/db/schema";
import { BUSINESS_OFFSET_MS, dayKey } from "@/lib/business-time";
import type { Cell } from "@/lib/csv";
import { outer } from "./input";
import { PRODUCT_COLUMNS } from "./product-import";
import { poNumber } from "./purchase-orders";
import { saleNumber } from "./sales";

/**
 * The tables people take out of Stocktake, as rows for a CSV file. Headers are English
 * and stay put whatever language the reader uses, so a spreadsheet or a script built on
 * one export keeps working on the next. Money is US dollars, as it's stored, written
 * with two decimals and no symbol; days and times are on the business's clock.
 */

const dollars = (cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2));
const day = (date: Date | null) => (date ? dayKey(date) : null);
/** 24-hour wall-clock time on the business's clock, like 14:05. */
const time = (date: Date) => new Date(date.getTime() + BUSINESS_OFFSET_MS).toISOString().slice(11, 16);

/** The catalog, active products only, under the columns the import reads back. */
export async function productRows(db: Database): Promise<Cell[][]> {
  const rows = await db
    .select({
      sku: products.sku,
      name: products.name,
      category: products.category,
      supplier: suppliers.name,
      unitCost: products.unitCostCents,
      unitPrice: products.unitPriceCents,
      reorderPoint: products.reorderPoint,
      reorderQuantity: products.reorderQuantity,
      onHand: products.onHand,
      description: products.description,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(isNull(products.archivedAt))
    .orderBy(asc(products.name));
  return [
    PRODUCT_COLUMNS.map((column) => column.header),
    ...rows.map((p) =>
      PRODUCT_COLUMNS.map(({ key }) =>
        key === "unitCost" ? dollars(p.unitCost) : key === "unitPrice" ? dollars(p.unitPrice) : p[key],
      ),
    ),
  ];
}

/** Every supplier, archived ones marked, with their terms and how they're rated. */
export async function supplierRows(db: Database): Promise<Cell[][]> {
  const rows = await db
    .select({
      name: suppliers.name,
      email: suppliers.email,
      phone: suppliers.phone,
      leadTimeDays: suppliers.leadTimeDays,
      products: sql<number>`(SELECT count(*) FROM ${products} WHERE ${products.supplierId} = ${outer(suppliers, "id")} AND ${products.archivedAt} IS NULL)`,
      rating: sql<
        number | null
      >`(SELECT round(avg(${supplierReviews.rating}), 1) FROM ${supplierReviews} WHERE ${supplierReviews.supplierId} = ${outer(suppliers, "id")})`,
      reviews: sql<number>`(SELECT count(*) FROM ${supplierReviews} WHERE ${supplierReviews.supplierId} = ${outer(suppliers, "id")})`,
      archivedAt: suppliers.archivedAt,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
  return [
    ["Name", "Email", "Phone", "Lead time (days)", "Products", "Rating", "Reviews", "Archived on"],
    ...rows.map((s) => [
      s.name,
      s.email,
      s.phone,
      s.leadTimeDays,
      Number(s.products),
      s.rating === null ? null : Number(s.rating),
      Number(s.reviews),
      day(s.archivedAt),
    ]),
  ];
}

/** What a line has had in (receipts) or sent back, in units. */
const lineTotal = (kind: "receipt" | "supplier_return") =>
  sql<number>`coalesce((SELECT sum(${stockMovements.quantity}) FROM ${stockMovements} WHERE ${stockMovements.purchaseOrderLineId} = ${purchaseOrderLines.id} AND ${stockMovements.kind} = ${kind}), 0)`.mapWith(
    Number,
  );

/** Every purchase order, one row per line, with the order's dates and what came in. */
export async function orderRows(db: Database): Promise<Cell[][]> {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      status: purchaseOrders.status,
      supplier: suppliers.name,
      createdAt: purchaseOrders.createdAt,
      orderedAt: purchaseOrders.orderedAt,
      expectedAt: purchaseOrders.expectedAt,
      receivedAt: purchaseOrders.receivedAt,
      cancelledAt: purchaseOrders.cancelledAt,
      sku: products.sku,
      product: products.name,
      quantity: purchaseOrderLines.quantity,
      received: lineTotal("receipt"),
      returned: lineTotal("supplier_return"),
      unitCost: purchaseOrderLines.unitCostCents,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .innerJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .innerJoin(products, eq(products.id, purchaseOrderLines.productId))
    .orderBy(asc(purchaseOrders.id), asc(purchaseOrderLines.id));
  return [
    [
      "Order",
      "Status",
      "Supplier",
      "Drafted",
      "Placed",
      "Expected",
      "Received",
      "Cancelled",
      "SKU",
      "Product",
      "Ordered",
      "Received units",
      "Sent back",
      "Unit cost (USD)",
      "Line total (USD)",
    ],
    ...rows.map((o) => [
      poNumber(o.id),
      STATUS_NAMES[o.status],
      o.supplier,
      day(o.createdAt),
      day(o.orderedAt),
      day(o.expectedAt),
      day(o.receivedAt),
      day(o.cancelledAt),
      o.sku,
      o.product,
      o.quantity,
      o.received,
      -o.returned,
      dollars(o.unitCost),
      dollars(o.quantity * o.unitCost),
    ]),
  ];
}

const STATUS_NAMES = { draft: "Draft", ordered: "Placed", received: "Received", cancelled: "Cancelled" } as const;

const KIND_NAMES: Record<MovementKind, string> = {
  receipt: "Receipt",
  sale: "Sale",
  adjustment: "Count",
  return: "Return",
  write_off: "Write-off",
  supplier_return: "Sent back to supplier",
};

/**
 * The ledger between two moments [from, to), oldest first: every movement with its
 * product, the balance after it for that product, who recorded it and the order it
 * belongs to. An undo names the entry it reverses.
 */
export async function ledgerRows(db: Database, from: Date, to: Date): Promise<Cell[][]> {
  const balance = sql<number>`sum(${stockMovements.quantity}) OVER (PARTITION BY ${stockMovements.productId} ORDER BY ${stockMovements.occurredAt}, ${stockMovements.id})`;
  // The balance needs every earlier movement, so the window runs over the whole ledger
  // and the period is picked from it afterwards.
  const ledger = db
    .select({
      id: stockMovements.id,
      productId: stockMovements.productId,
      kind: stockMovements.kind,
      quantity: stockMovements.quantity,
      balance: balance.as("balance"),
      note: stockMovements.note,
      occurredAt: stockMovements.occurredAt,
      userId: stockMovements.userId,
      lineId: stockMovements.purchaseOrderLineId,
      reversesId: stockMovements.reversesId,
    })
    .from(stockMovements)
    .where(lt(stockMovements.occurredAt, to))
    .as("ledger");
  const line = alias(purchaseOrderLines, "line");
  const rows = await db
    .select({
      id: ledger.id,
      kind: ledger.kind,
      quantity: ledger.quantity,
      balance: ledger.balance,
      note: ledger.note,
      occurredAt: ledger.occurredAt,
      reversesId: ledger.reversesId,
      sku: products.sku,
      product: products.name,
      person: users.name,
      orderId: line.purchaseOrderId,
    })
    .from(ledger)
    .innerJoin(products, eq(products.id, ledger.productId))
    .leftJoin(users, eq(users.id, ledger.userId))
    .leftJoin(line, eq(line.id, ledger.lineId))
    .where(gte(ledger.occurredAt, from))
    .orderBy(asc(ledger.occurredAt), asc(ledger.id));
  return [
    [
      "Entry",
      "Date",
      "Time",
      "SKU",
      "Product",
      "Kind",
      "Quantity",
      "Balance",
      "Order",
      "Person",
      "Note",
      "Undoes entry",
    ],
    ...rows.map((m) => [
      m.id,
      dayKey(m.occurredAt),
      time(m.occurredAt),
      m.sku,
      m.product,
      m.reversesId ? "Undo" : KIND_NAMES[m.kind],
      m.quantity,
      Number(m.balance),
      m.orderId ? poNumber(m.orderId) : null,
      m.person,
      m.note,
      m.reversesId,
    ]),
  ];
}

/** Every sale with prices, one row per line, oldest first: what went for how much, to whom. */
export async function saleRows(db: Database): Promise<Cell[][]> {
  const rows = await db
    .select({
      id: sales.id,
      soldAt: sales.soldAt,
      customer: customers.name,
      voidedAt: sales.voidedAt,
      sku: products.sku,
      product: products.name,
      quantity: saleLines.quantity,
      unitPrice: saleLines.unitPriceCents,
      discount: saleLines.discountCents,
      net: saleLines.netCents,
    })
    .from(saleLines)
    .innerJoin(sales, eq(sales.id, saleLines.saleId))
    .innerJoin(products, eq(products.id, saleLines.productId))
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .orderBy(asc(sales.soldAt), asc(sales.id), asc(saleLines.id));
  return [
    [
      "Sale",
      "Date",
      "Time",
      "Customer",
      "SKU",
      "Product",
      "Quantity",
      "Unit price (USD)",
      "Line discount (USD)",
      "Net (USD)",
      "Voided on",
    ],
    ...rows.map((r) => [
      saleNumber(r.id),
      dayKey(r.soldAt),
      time(r.soldAt),
      r.customer ?? "Walk-in",
      r.sku,
      r.product,
      r.quantity,
      dollars(r.unitPrice),
      dollars(r.discount),
      dollars(r.net),
      day(r.voidedAt),
    ]),
  ];
}
