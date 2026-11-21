import { z } from "zod";
import type { Database } from "@/db/database";
import type { PurchaseOrderStatus } from "@/db/schema";
import { PERIODS, getAnalytics } from "@/domain/analytics";
import { DomainError } from "@/domain/errors";
import { type StockForecast, getProductForecast, getStockForecasts } from "@/domain/forecast";
import { deliveryRecord, getOrder, listOrders } from "@/domain/purchase-orders";
import { getReorderSuggestions } from "@/domain/reorder";
import { listMovements } from "@/domain/stock";
import { getSupplier, listSuppliers } from "@/domain/suppliers";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { DOLLARS, type MoneyFormat, moneyFormat } from "@/lib/money";

/**
 * The assistant's tools: a few typed, read-only queries over the domain layer. The
 * model picks a tool and its arguments; the arguments are parsed with zod before anything
 * runs, and the model never sees or writes SQL. Drafting an order only proposes one; the
 * person writes it from the proposal in the UI, through the usual Server Action.
 *
 * What a tool returns to the model is reshaped for reading: money as formatted text in
 * the currency the person reads in,
 * dates as UTC days, figures rounded, so the model repeats numbers rather than computing
 * them.
 */

/** A record an answer can link to. `code` is its SKU or PO number. */
/** A tool refusing its arguments. Said to the model, in English, so it can correct itself. */
class ToolRefusal extends Error {}

export type Ref = { kind: "product" | "supplier" | "order"; id: number; label: string; code?: string };

export type ProposalLine = {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitCostCents: number;
  onHand: number;
};

/** An order the assistant suggests drafting. Nothing is written until the person confirms it. */
export type Proposal = {
  supplierId: number;
  supplierName: string;
  lines: ProposalLine[];
  totalCents: number;
};

export type ToolOutcome = {
  /** What the model is shown. */
  data: unknown;
  refs: Ref[];
  /** One line for the person: what was looked up and what came back. */
  summary: string;
  proposal?: Proposal;
};

/**
 * What a tool runs with. `language` is the person's: it only changes the step summaries
 * they read under an answer. What the model reads stays English, with Latin digits.
 */
type Context = { db: Database; now: Date; money: MoneyFormat; language: Language };

type Tool<S extends z.ZodObject> = {
  name: string;
  description: string;
  input: S;
  run: (context: Context, args: z.output<S>) => Promise<ToolOutcome>;
};

const tool = <S extends z.ZodObject>(definition: Tool<S>) => definition;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A UTC day the way every page prints it: "Nov 14", with the year only when it isn't this one. */
const day = (date: Date | null, now: Date) => (date ? formats("en").date(date, now) : null);
const round = (n: number | null, places = 1) => (n === null ? null : Number(n.toFixed(places)));
const startOfDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A count in a Bangla step summary: "১২টি". */
const bn = (n: number) => `${formats("bn").count(n)}টি`;
/** A step summary in the person's language. */
const say = (language: Language, english: string, bangla: string) => (language === "bn" ? bangla : english);

const productRef = (p: { id: number; name: string; sku: string }): Ref => ({
  kind: "product",
  id: p.id,
  label: p.name,
  code: p.sku,
});
const supplierRef = (s: { id: number; name: string }): Ref => ({ kind: "supplier", id: s.id, label: s.name });
const orderRef = (o: { id: number; number: string; supplierName: string }): Ref => ({
  kind: "order",
  id: o.id,
  label: o.number,
  code: o.number,
});

const STATUS_WORDS = { out: "out of stock", reorder: "reorder now", ok: "enough stock" } as const;

/** A product's stock picture, as the model reads it. */
function stockFacts(f: StockForecast, now: Date, money: MoneyFormat) {
  return {
    productId: f.id,
    sku: f.sku,
    name: f.name,
    category: f.category,
    supplier: f.supplierName,
    supplierId: f.supplierId,
    status: STATUS_WORDS[f.status],
    onHand: f.onHand,
    onOrder: f.onOrder,
    reorderPoint: f.reorderPoint,
    soldPerDay: round(f.dailyDemand, 2),
    daysOfCover: round(f.daysOfCover),
    // An empty shelf has no day ahead to run out on; "today" read as "out since today".
    runsOutOn: f.onHand === 0 ? null : day(f.stockoutAt, now),
    leadTimeDays: f.leadTimeDays,
    suggestedOrder: f.suggestedQuantity,
    unitCost: money.money(f.unitCostCents),
    price: money.money(f.unitPriceCents),
  };
}

const text = (max: number) => z.string().trim().min(1).max(max);
const recordId = z.number().int().positive();

const searchProducts = tool({
  name: "search_products",
  description:
    "Find active products by name, SKU, category or supplier, or by stock status. Returns each one's stock on hand, " +
    "units on placed orders, average units sold per day over the last 28 days, days of cover, the day it runs out, " +
    "the supplier's lead time and the suggested reorder quantity. Leave every filter out to list the most urgent products.",
  input: z.object({
    query: text(80).optional().describe("Words that must all appear in the name, SKU, category or supplier."),
    status: z
      .enum(["out", "reorder", "ok"])
      .optional()
      .describe("out: none on hand. reorder: order now. ok: enough stock."),
    limit: z.number().int().min(1).max(25).optional().describe("At most this many, most urgent first. Default 10."),
  }),
  async run({ db, now, money, language }, { query, status, limit = 10 }) {
    const words = query?.toLowerCase().split(/\s+/) ?? [];
    const matched = (await getStockForecasts(db, now)).filter((f) => {
      if (status && f.status !== status) return false;
      const haystack = [f.name, f.sku, f.category, f.supplierName].join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
    const shown = matched.slice(0, limit);
    const filters = [query && `“${query}”`, status && STATUS_WORDS[status]].filter(Boolean).join(", ");
    return {
      data: { matched: matched.length, shown: shown.length, products: shown.map((f) => stockFacts(f, now, money)) },
      refs: shown.map(productRef),
      summary: say(
        language,
        `Searched products${filters ? ` for ${filters}` : ""}: ${plural(matched.length, "match", "matches")}`,
        `পণ্য খোঁজা হলো${query ? ` “${query}”` : ""}: ${bn(matched.length)} মিলেছে`,
      ),
    };
  },
});

const getProductTool = tool({
  name: "get_product",
  description:
    "One product's stock picture and its latest stock movements (receipts, sales, counts, returns, write-offs), " +
    "newest first, with the balance after each.",
  input: z.object({ productId: recordId }),
  async run({ db, now, money, language }, { productId }) {
    const f = await getProductForecast(db, productId, now);
    const movements = await listMovements(db, productId, { limit: 12 });
    return {
      data: {
        ...stockFacts(f, now, money),
        archived: f.archivedAt !== null,
        description: f.description,
        latestMovements: movements.map((m) => ({
          day: day(m.occurredAt, now),
          kind: m.kind.replace("_", "-"),
          quantity: m.quantity,
          balanceAfter: m.balance,
          by: m.userName,
          note: m.note,
        })),
      },
      refs: [productRef(f)],
      summary: say(
        language,
        `Read ${f.name}: ${plural(f.onHand, "unit")} on hand, ${plural(movements.length, "recent movement")}`,
        `${f.name} দেখা হলো: মজুত ${formats("bn").count(f.onHand)}, সাম্প্রতিক লেনদেন ${bn(movements.length)}`,
      ),
    };
  },
});

const listSuppliersTool = tool({
  name: "list_suppliers",
  description:
    "Every active supplier with its lead time, average review rating, product count, how many of its products need " +
    "reordering, units on order, and its delivery record (orders received by their due day).",
  input: z.object({}),
  async run({ db, now, language }) {
    const [suppliers, forecasts, orders] = await Promise.all([
      listSuppliers(db),
      getStockForecasts(db, now),
      listOrders(db),
    ]);
    const data = suppliers.map((s) => {
      const theirs = forecasts.filter((f) => f.supplierId === s.id);
      const record = deliveryRecord(orders.filter((o) => o.supplierId === s.id));
      return {
        supplierId: s.id,
        name: s.name,
        leadTimeDays: s.leadTimeDays,
        rating: round(s.averageRating),
        reviews: s.reviewCount,
        products: s.productCount,
        needReorder: theirs.filter((f) => f.status !== "ok").length,
        unitsOnOrder: theirs.reduce((sum, f) => sum + f.onOrder, 0),
        ordersReceived: record.received,
        receivedOnTime: record.onTime,
      };
    });
    return {
      data: { suppliers: data },
      refs: suppliers.map(supplierRef),
      summary: say(language, `Listed suppliers: ${suppliers.length}`, `সরবরাহকারীর তালিকা: ${bn(suppliers.length)}`),
    };
  },
});

const getSupplierTool = tool({
  name: "get_supplier",
  description:
    "One supplier: contact details, lead time, rating with the latest reviews, its products' stock, and its open orders.",
  input: z.object({ supplierId: recordId }),
  async run({ db, now, money, language }, { supplierId }) {
    const [supplier, forecasts, orders] = await Promise.all([
      getSupplier(db, supplierId),
      getStockForecasts(db, now),
      listOrders(db, { supplierId }),
    ]);
    const products = forecasts.filter((f) => f.supplierId === supplierId);
    const open = orders.filter((o) => o.status === "draft" || o.status === "ordered");
    const record = deliveryRecord(orders.map((o) => ({ ...o, leadTimeDays: supplier.leadTimeDays })));
    return {
      data: {
        supplierId: supplier.id,
        name: supplier.name,
        archived: supplier.archivedAt !== null,
        email: supplier.email,
        phone: supplier.phone,
        leadTimeDays: supplier.leadTimeDays,
        rating: round(supplier.averageRating),
        ordersReceived: record.received,
        receivedOnTime: record.onTime,
        latestReviews: supplier.reviews
          .slice(0, 3)
          .map((r) => ({ by: r.userName, stars: r.rating, comment: r.comment })),
        products: products.map((f) => stockFacts(f, now, money)),
        openOrders: open.map((o) => ({ orderId: o.id, number: o.number, status: o.status, due: day(o.dueAt, now) })),
      },
      refs: [supplierRef(supplier), ...products.map(productRef), ...open.map(orderRef)],
      summary: say(
        language,
        `Read ${supplier.name}: ${plural(products.length, "product")}, ${plural(open.length, "open order")}`,
        `${supplier.name} দেখা হলো: ${bn(products.length)} পণ্য, ${bn(open.length)} খোলা অর্ডার`,
      ),
    };
  },
});

const ORDER_STATUSES = ["draft", "ordered", "received", "cancelled"] as const satisfies PurchaseOrderStatus[];

const listOrdersTool = tool({
  name: "list_orders",
  description:
    "Purchase orders, newest first. draft: being written. ordered: placed with the supplier, not yet received. " +
    "Late means placed and past its due day. Each has its supplier, line count, total and due day.",
  input: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    late: z.boolean().optional().describe("Only placed orders past their due day."),
    supplierId: recordId.optional(),
    limit: z.number().int().min(1).max(25).optional().describe("Default 15."),
  }),
  async run({ db, now, money, language }, { status, late, supplierId, limit = 15 }) {
    const today = startOfDay(now);
    const isLate = (o: { status: string; dueAt: Date | null }) =>
      o.status === "ordered" && o.dueAt !== null && startOfDay(o.dueAt) < today;
    const orders = (await listOrders(db, { status: late ? "ordered" : status, supplierId })).filter(
      (o) => !late || isLate(o),
    );
    const shown = orders.slice(0, limit);
    return {
      data: {
        matched: orders.length,
        orders: shown.map((o) => ({
          orderId: o.id,
          number: o.number,
          status: o.status,
          late: isLate(o),
          daysLate: isLate(o) && o.dueAt ? Math.round((today - startOfDay(o.dueAt)) / DAY_MS) : 0,
          supplier: o.supplierName,
          supplierId: o.supplierId,
          lines: o.lineCount,
          total: money.money(o.totalCents),
          created: day(o.createdAt, now),
          placed: day(o.orderedAt, now),
          due: day(o.dueAt, now),
          received: day(o.receivedAt, now),
        })),
      },
      refs: shown.map(orderRef),
      summary: say(
        language,
        `Listed ${late ? "late " : status ? `${status} ` : ""}orders: ${orders.length}`,
        `${late ? "দেরির " : ""}অর্ডারের তালিকা: ${bn(orders.length)}`,
      ),
    };
  },
});

const getOrderTool = tool({
  name: "get_order",
  description: "One purchase order with its lines: product, quantity, unit cost and line total.",
  input: z.object({ orderId: recordId }),
  async run({ db, now, money, language }, { orderId }) {
    const o = await getOrder(db, orderId);
    return {
      data: {
        orderId: o.id,
        number: o.number,
        status: o.status,
        supplier: o.supplierName,
        supplierId: o.supplierId,
        createdBy: o.createdByName,
        created: day(o.createdAt, now),
        placed: day(o.orderedAt, now),
        due: day(o.dueAt, now),
        received: day(o.receivedAt, now),
        cancelled: day(o.cancelledAt, now),
        notes: o.notes,
        lines: o.lines.map((l) => ({
          productId: l.productId,
          sku: l.sku,
          name: l.name,
          quantity: l.quantity,
          unitCost: money.money(l.unitCostCents),
          lineTotal: money.money(l.lineTotalCents),
        })),
        total: money.money(o.totalCents),
      },
      refs: [
        orderRef(o),
        supplierRef({ id: o.supplierId, name: o.supplierName }),
        ...o.lines.map((l) => productRef({ ...l, id: l.productId })),
      ],
      summary: say(
        language,
        `Read ${o.number}: ${o.status}, ${plural(o.lines.length, "line")}`,
        `${o.number} দেখা হলো: ${bn(o.lines.length)} লাইন`,
      ),
    };
  },
});

const salesSummary = tool({
  name: "sales_summary",
  description:
    "Sales over the last 28 or 90 UTC days, ending today: units, sales value and margin (valued at today's prices, " +
    "since the ledger records units), the best sellers by value, the slowest-moving stock, and sales by category.",
  input: z.object({
    days: z
      .union(PERIODS.map((n) => z.literal(n)))
      .optional()
      .describe("28 or 90. Default 28."),
  }),
  async run({ db, now, money, language }, { days = 28 }) {
    const a = await getAnalytics(db, days, now);
    const figures = (p: (typeof a.best)[number]) => ({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unitsSold: p.netSold,
      sales: money.money(p.salesCents),
      onHand: p.onHand,
      stockLastsDays: round(p.lastsDays),
    });
    return {
      data: {
        from: day(a.from, now),
        to: day(new Date(a.to.getTime() - 1), now),
        unitsSold: a.sales.units,
        sales: money.money(a.sales.valueCents),
        margin: money.money(a.sales.marginCents),
        bestSellers: a.best.map(figures),
        slowestMoving: a.slowest.map(figures),
        categories: a.categories.map((c) => ({
          name: c.name,
          products: c.products,
          sales: money.money(c.salesCents),
          margin: money.money(c.marginCents),
          stockValue: money.money(c.stockCents),
        })),
      },
      refs: [...a.best, ...a.slowest].map(productRef),
      summary: say(
        language,
        `Summed sales for the last ${days} days: ${plural(a.sales.units, "unit")}`,
        `গত ${formats("bn").count(days)} দিনের বিক্রি যোগ করা হলো: ${formats("bn").count(a.sales.units)} ইউনিট`,
      ),
    };
  },
});

const draftPurchaseOrder = tool({
  name: "draft_purchase_order",
  description:
    "Propose a draft purchase order to one supplier, for the person to review and write. It does not create anything: " +
    "the person sees the proposal and decides. Leave lines out to propose everything the forecast says to reorder from " +
    "that supplier, or give lines with product IDs and quantities. Products must be that supplier's own.",
  input: z.object({
    supplierId: recordId,
    lines: z
      .array(z.object({ productId: recordId, quantity: z.number().int().min(1).max(100_000) }))
      .min(1)
      .max(50)
      .optional(),
  }),
  async run({ db, now, money, language }, { supplierId, lines }) {
    const [supplier, forecasts] = await Promise.all([getSupplier(db, supplierId), getStockForecasts(db, now)]);
    if (supplier.archivedAt) throw new ToolRefusal(`${supplier.name} is archived and takes no orders.`);

    let chosen: { forecast: StockForecast; quantity: number }[];
    if (lines) {
      chosen = lines.map(({ productId, quantity }) => {
        const forecast = forecasts.find((f) => f.id === productId);
        if (!forecast) throw new ToolRefusal(`Product ${productId} doesn't exist or is archived.`);
        if (forecast.supplierId !== supplierId) {
          throw new ToolRefusal(`${supplier.name} doesn't supply ${forecast.name}.`);
        }
        return { forecast, quantity };
      });
      if (new Set(lines.map((l) => l.productId)).size !== lines.length) {
        throw new ToolRefusal("Each product can appear on an order once.");
      }
    } else {
      const { suppliers } = await getReorderSuggestions(db, now, forecasts);
      const group = suppliers.find((s) => s.supplierId === supplierId);
      const open = group?.lines.filter((l) => l.draftId === null) ?? [];
      if (open.length === 0) {
        throw new ToolRefusal(
          group
            ? `Everything ${supplier.name} should send is on a draft already.`
            : `Nothing from ${supplier.name} needs ordering right now.`,
        );
      }
      chosen = open.map((l) => ({ forecast: forecasts.find((f) => f.id === l.productId)!, quantity: l.quantity }));
    }

    const proposalLines = chosen.map(({ forecast: f, quantity }) => ({
      productId: f.id,
      sku: f.sku,
      name: f.name,
      quantity,
      unitCostCents: f.unitCostCents,
      onHand: f.onHand,
    }));
    const proposal: Proposal = {
      supplierId,
      supplierName: supplier.name,
      lines: proposalLines,
      totalCents: proposalLines.reduce((sum, l) => sum + l.quantity * l.unitCostCents, 0),
    };
    return {
      data: {
        proposed: true,
        note: "Shown to the person to review. Nothing has been written yet.",
        supplier: supplier.name,
        lines: proposalLines.map((l) => ({
          name: l.name,
          sku: l.sku,
          quantity: l.quantity,
          unitCost: money.money(l.unitCostCents),
        })),
        total: money.money(proposal.totalCents),
      },
      refs: [supplierRef(supplier), ...chosen.map(({ forecast }) => productRef(forecast))],
      summary: say(
        language,
        `Proposed an order to ${supplier.name}: ${plural(proposalLines.length, "line")}, ${money.money(proposal.totalCents)}`,
        `${supplier.name}-এর জন্য অর্ডারের প্রস্তাব: ${bn(proposalLines.length)} লাইন`,
      ),
      proposal,
    };
  },
});

export const TOOLS = [
  searchProducts,
  getProductTool,
  listSuppliersTool,
  getSupplierTool,
  listOrdersTool,
  getOrderTool,
  salesSummary,
  draftPurchaseOrder,
];

/** The tool definitions as Workers AI takes them (OpenAI's function format). */
export const TOOL_DEFINITIONS = TOOLS.map((t) => {
  const parameters = z.toJSONSchema(t.input) as Record<string, unknown>;
  delete parameters.$schema;
  return { type: "function" as const, function: { name: t.name, description: t.description, parameters } };
});

/** Models sometimes send null for an argument they mean to leave out. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, withoutNulls(v)]),
    );
  }
  return value;
}

export type ToolRun = { ok: true; outcome: ToolOutcome } | { ok: false; error: string };

/**
 * Runs one tool call from the model. The arguments arrive as a JSON string; anything
 * that doesn't parse, doesn't match the tool's schema or names a missing record comes
 * back as an error the model can read and correct, never as an exception.
 */
export async function runTool(
  given: Omit<Context, "money" | "language"> & { money?: MoneyFormat; language?: Language },
  name: string,
  rawArguments: string,
): Promise<ToolRun> {
  const context: Context = { ...given, money: given.money ?? moneyFormat(DOLLARS), language: given.language ?? "en" };
  const definition = TOOLS.find((t) => t.name === name);
  if (!definition) return { ok: false, error: `There is no tool called ${name}.` };

  let json: unknown;
  try {
    json = rawArguments.trim() === "" ? {} : JSON.parse(rawArguments);
  } catch {
    return { ok: false, error: "The arguments weren't valid JSON." };
  }
  const parsed = definition.input.safeParse(withoutNulls(json));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Invalid arguments: ${issue.path.join(".") || "input"}: ${issue.message}` };
  }

  try {
    // Each definition's run takes its own schema's output; the lookup by name loses that link.
    const outcome = await (definition.run as Tool<z.ZodObject>["run"])(context, parsed.data);
    return { ok: true, outcome };
  } catch (error) {
    if (error instanceof DomainError || error instanceof ToolRefusal) return { ok: false, error: error.message };
    throw error;
  }
}
