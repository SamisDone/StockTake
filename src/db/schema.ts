import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Timestamps are Unix milliseconds. The database fills them in by default; the demo
// seed passes explicit values so the dataset is deterministic.
const now = sql`(cast(unixepoch('subsec') * 1000 as integer))`;
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => timestamp("created_at").notNull().default(now);

export const roles = ["admin", "staff"] as const;
export type Role = (typeof roles)[number];

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: roles }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check("users_role", sql`${t.role} IN ('admin', 'staff')`),
  ],
);

/** The ID is the SHA-256 hex of the session token; the token itself only lives in the cookie. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_id").on(t.userId)],
);

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  leadTimeDays: integer("lead_time_days").notNull().default(7),
  createdAt: createdAt(),
  archivedAt: timestamp("archived_at"),
});

export const supplierReviews = sqliteTable(
  "supplier_reviews",
  {
    id: integer("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("supplier_reviews_one_per_user").on(t.supplierId, t.userId),
    check("supplier_reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    unitCostCents: integer("unit_cost_cents").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    reorderPoint: integer("reorder_point").notNull().default(0),
    reorderQuantity: integer("reorder_quantity").notNull().default(0),
    /** Denormalised from stock_movements; triggers keep it equal to the ledger sum. */
    onHand: integer("on_hand").notNull().default(0),
    createdAt: createdAt(),
    archivedAt: timestamp("archived_at"),
  },
  (t) => [
    index("products_supplier_id").on(t.supplierId),
    check("products_sku_uppercase", sql`${t.sku} = upper(${t.sku})`),
    check("products_on_hand_nonnegative", sql`${t.onHand} >= 0`),
    check("products_money_nonnegative", sql`${t.unitCostCents} >= 0 AND ${t.unitPriceCents} >= 0`),
    check("products_reorder_nonnegative", sql`${t.reorderPoint} >= 0 AND ${t.reorderQuantity} >= 0`),
  ],
);

export const purchaseOrderStatuses = ["draft", "ordered", "received", "cancelled"] as const;
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number];

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: integer("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: text("status", { enum: purchaseOrderStatuses }).notNull().default("draft"),
    notes: text("notes"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    expectedAt: timestamp("expected_at"),
    orderedAt: timestamp("ordered_at"),
    receivedAt: timestamp("received_at"),
    cancelledAt: timestamp("cancelled_at"),
  },
  (t) => [
    index("purchase_orders_supplier_id").on(t.supplierId),
    index("purchase_orders_status").on(t.status),
    check("purchase_orders_status", sql`${t.status} IN ('draft', 'ordered', 'received', 'cancelled')`),
    check(
      "purchase_orders_status_timestamps",
      sql`CASE ${t.status}
        WHEN 'draft' THEN ${t.orderedAt} IS NULL AND ${t.receivedAt} IS NULL AND ${t.cancelledAt} IS NULL
        WHEN 'ordered' THEN ${t.orderedAt} IS NOT NULL AND ${t.receivedAt} IS NULL AND ${t.cancelledAt} IS NULL
        WHEN 'received' THEN ${t.orderedAt} IS NOT NULL AND ${t.receivedAt} IS NOT NULL AND ${t.cancelledAt} IS NULL
        WHEN 'cancelled' THEN ${t.cancelledAt} IS NOT NULL AND ${t.receivedAt} IS NULL
      END`,
    ),
  ],
);

export const purchaseOrderLines = sqliteTable(
  "purchase_order_lines",
  {
    id: integer("id").primaryKey(),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
  },
  (t) => [
    uniqueIndex("purchase_order_lines_one_per_product").on(t.purchaseOrderId, t.productId),
    index("purchase_order_lines_product_id").on(t.productId),
    check("purchase_order_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("purchase_order_lines_cost_nonnegative", sql`${t.unitCostCents} >= 0`),
  ],
);

export const movementKinds = ["receipt", "sale", "adjustment", "return", "write_off", "supplier_return"] as const;
export type MovementKind = (typeof movementKinds)[number];

/**
 * The stock ledger and the source of truth for stock levels. Rows are append-only;
 * a correction is a new adjustment. Quantities are signed: receipts and returns add,
 * sales, write-offs and returns to the supplier remove, adjustments go either way.
 * Receipts and returns to the supplier belong to a purchase order line: a line can be
 * received in several parts, never past what was ordered, and sent back only up to what
 * it received. An undo is an adjustment that
 * reverses one earlier movement exactly (`reverses_id`), and it counts as that
 * movement's kind wherever the ledger is summed by kind. A sale made with prices (a
 * `sales` record) takes its stock as one sale movement per line (`sale_line_id`); voiding
 * the sale reverses each one.
 */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    kind: text("kind", { enum: movementKinds }).notNull(),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    /** Set on receipts and returns to the supplier, and only on those. */
    purchaseOrderLineId: integer("purchase_order_line_id").references(() => purchaseOrderLines.id),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at").notNull().default(now),
    /** Set on an undo: the movement it reverses. Unique, so a movement can be undone once. */
    reversesId: integer("reverses_id")
      .unique()
      .references((): AnySQLiteColumn => stockMovements.id),
    /** Set on a sale made through a priced sale: the line it took stock for. One movement per line. */
    saleLineId: integer("sale_line_id")
      .unique()
      .references((): AnySQLiteColumn => saleLines.id),
  },
  (t) => [
    index("stock_movements_product_occurred").on(t.productId, t.occurredAt),
    index("stock_movements_purchase_order_line").on(t.purchaseOrderLineId),
    check(
      "stock_movements_kind",
      sql`${t.kind} IN ('receipt', 'sale', 'adjustment', 'return', 'write_off', 'supplier_return')`,
    ),
    check(
      "stock_movements_quantity_sign",
      sql`CASE ${t.kind}
        WHEN 'receipt' THEN ${t.quantity} > 0
        WHEN 'return' THEN ${t.quantity} > 0
        WHEN 'sale' THEN ${t.quantity} < 0
        WHEN 'write_off' THEN ${t.quantity} < 0
        WHEN 'supplier_return' THEN ${t.quantity} < 0
        WHEN 'adjustment' THEN ${t.quantity} <> 0
      END`,
    ),
    check(
      "stock_movements_receipt_line",
      sql`(${t.kind} IN ('receipt', 'supplier_return')) = (${t.purchaseOrderLineId} IS NOT NULL)`,
    ),
  ],
);

/** The people and businesses that buy, so a sale can be on credit and its due followed up. */
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  note: text("note"),
  createdAt: createdAt(),
});

/**
 * A sale with prices: who bought (or nobody, a walk-in), when, and a discount on the
 * whole sale. Its lines carry the products and what each brought in; its total is the
 * sum of their `net_cents`. Sales are never edited or deleted: a mistake is voided,
 * which puts the stock back and takes the sale out of what's owed.
 */
export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id),
    /** Off the whole sale, spread over its lines' `net_cents`. */
    discountCents: integer("discount_cents").notNull().default(0),
    note: text("note"),
    soldAt: timestamp("sold_at").notNull(),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    voidedAt: timestamp("voided_at"),
    voidedBy: integer("voided_by").references(() => users.id),
  },
  (t) => [
    index("sales_customer_id").on(t.customerId),
    index("sales_sold_at").on(t.soldAt),
    check("sales_discount_nonnegative", sql`${t.discountCents} >= 0`),
    check("sales_voided_together", sql`(${t.voidedAt} IS NULL) = (${t.voidedBy} IS NULL)`),
  ],
);

export const saleLines = sqliteTable(
  "sale_lines",
  {
    id: integer("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** Off this line. */
    discountCents: integer("discount_cents").notNull().default(0),
    /** What the line brought in: quantity × price, less its discount and its share of the sale's. */
    netCents: integer("net_cents").notNull(),
  },
  (t) => [
    uniqueIndex("sale_lines_one_per_product").on(t.saleId, t.productId),
    index("sale_lines_product_id").on(t.productId),
    check("sale_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("sale_lines_price_nonnegative", sql`${t.unitPriceCents} >= 0`),
    check(
      "sale_lines_discount_within_line",
      sql`${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.quantity} * ${t.unitPriceCents}`,
    ),
    check(
      "sale_lines_net_within_line",
      sql`${t.netCents} >= 0 AND ${t.netCents} <= ${t.quantity} * ${t.unitPriceCents} - ${t.discountCents}`,
    ),
  ],
);

export const paymentMethods = ["cash", "mobile", "card", "bank"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

/**
 * Money received: at the sale, or later against what a customer owes. A walk-in sale's
 * payment belongs to the sale alone; a customer's counts against everything they owe.
 * Append-only, and never more than what's owed.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id),
    saleId: integer("sale_id").references(() => sales.id),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: paymentMethods }).notNull(),
    note: text("note"),
    receivedAt: timestamp("received_at").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("payments_customer_id").on(t.customerId),
    index("payments_sale_id").on(t.saleId),
    check("payments_amount_positive", sql`${t.amountCents} > 0`),
    check("payments_method", sql`${t.method} IN ('cash', 'mobile', 'card', 'bank')`),
    check("payments_belong", sql`${t.customerId} IS NOT NULL OR ${t.saleId} IS NOT NULL`),
  ],
);

/** Append-only record of who did what, shown in the activity feed. */
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    summary: text("summary").notNull(),
    /**
     * The facts the summary was written from, as JSON, so each reader sees the entry in
     * their own language. The summary stays the English record; entries from before
     * migration 0005 have no facts and show it.
     */
    facts: text("facts", { mode: "json" }).$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at").notNull().default(now),
  },
  (t) => [index("activity_log_occurred").on(t.occurredAt), index("activity_log_entity").on(t.entityType, t.entityId)],
);

/**
 * What the assistant has used, per person per business day: questions asked and the
 * Workers AI neurons they cost. The daily cap is checked against it before the model is
 * called.
 */
export const assistantUsage = sqliteTable(
  "assistant_usage",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The business day (Asia/Dhaka), as YYYY-MM-DD. */
    day: text("day").notNull(),
    questions: integer("questions").notNull().default(0),
    neurons: real("neurons").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    index("assistant_usage_day").on(t.day),
    check("assistant_usage_questions", sql`${t.questions} >= 0`),
    check("assistant_usage_neurons", sql`${t.neurons} >= 0`),
  ],
);

/**
 * Neurons all accounts together have spent per UTC day. Workers AI resets its free
 * allocation at 00:00 UTC, so this budget keeps Cloudflare's day, not the business's:
 * counted per Dhaka day, it could straddle two of Cloudflare's and overspend them.
 */
export const assistantBudget = sqliteTable(
  "assistant_budget",
  {
    /** The UTC day, as YYYY-MM-DD. */
    day: text("day").primaryKey(),
    neurons: real("neurons").notNull().default(0),
  },
  (t) => [check("assistant_budget_neurons", sql`${t.neurons} >= 0`)],
);

/**
 * What one US dollar buys in another currency, refreshed from a public rate source. Money
 * is stored in US cents; another currency is only ever a conversion for display.
 */
export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    currency: text("currency").primaryKey(),
    perUsd: real("per_usd").notNull(),
    /** The day the source published the rate, as YYYY-MM-DD. */
    asOf: text("as_of").notNull(),
    fetchedAt: timestamp("fetched_at").notNull(),
  },
  (t) => [check("exchange_rates_positive", sql`${t.perUsd} > 0`)],
);
