"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import {
  type DraftInput,
  cancelOrder,
  createDraft,
  getOrder,
  placeOrder,
  poNumber,
  receiveOrder,
  updateDraft,
} from "@/domain/purchase-orders";
import { draftSuggestedOrder } from "@/domain/reorder";
import { formatCount } from "@/lib/format";
import { parseCents, parseUnits } from "@/lib/parse";
import { authorize } from "./dal";
import { type FormState, field, formError } from "./form-state";

/** What an order's action forms get back: an error, or what was done. */
export type OrderFormState = FormState & {
  /** Set after a successful change. `at` changes every time. */
  done?: { message: string; at: number };
};

const positiveId = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Drafts an order to one supplier from the reorder suggestions, worked out again on
 * the server, then opens it. Anyone can draft; an admin places it.
 */
export async function draftFromSuggestions(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db, user } = await authorize();
  const supplierId = positiveId(field(formData, "supplierId"));
  if (supplierId === null) return { error: { message: "That supplier doesn't exist." } };

  let id: number;
  try {
    ({ id } = await draftSuggestedOrder(db, user, supplierId));
  } catch (error) {
    return formError(error);
  }
  // Outside the try: redirect() works by throwing.
  redirect(`/orders/${id}`);
}

type Intent = "place" | "cancel" | "receive";
const INTENTS: Intent[] = ["place", "cancel", "receive"];

/**
 * Places, cancels or receives an order. The domain decides who may (placing and
 * cancelling are an admin's) and whether the order's state allows it.
 */
export async function changeOrder(_previous: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const { db, user } = await authorize();
  const orderId = positiveId(field(formData, "orderId"));
  const intent = field(formData, "intent") as Intent;
  if (!INTENTS.includes(intent)) return { error: { message: "Choose what to do with the order." } };
  if (orderId === null) return { error: { message: "That purchase order doesn't exist." } };

  let message: string;
  try {
    if (intent === "place") {
      await placeOrder(db, user, orderId);
      const order = await getOrder(db, orderId);
      message = `Placed ${order.number} with ${order.supplierName}.`;
    } else if (intent === "cancel") {
      await cancelOrder(db, user, orderId);
      message = `Cancelled ${poNumber(orderId)}.`;
    } else {
      await receiveOrder(db, user, orderId);
      const order = await getOrder(db, orderId);
      const units = order.lines.reduce((total, line) => total + line.quantity, 0);
      message = `Received ${order.number}: ${formatCount(units)} units booked into stock.`;
    }
  } catch (error) {
    return formError(error);
  }

  refresh();
  return { done: { message, at: Date.now() } };
}

/** What the draft form gets back: what's wrong with it, or the draft it saved. */
export type DraftFormState = {
  /**
   * A message per field at fault. A line's fields are keyed by its product:
   * `quantity-<productId>` and `unitCost-<productId>`.
   */
  fields?: Record<string, string>;
  /** A problem with the order as a whole. */
  error?: { message: string };
  /** Set after a draft is saved. `at` changes on every save. */
  saved?: { id: number; at: number };
};

const MAX_UNITS = 1_000_000;
const MAX_COST_CENTS = 100_000_000;

/** A calendar date from a date input ("2026-11-28") as midnight UTC, the way orders store days. */
function parseDay(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date;
}

/**
 * Writes a draft by hand: a new order when the form names a supplier, or a draft's
 * new lines, notes and expected date when it carries the order's ID (its supplier
 * stays). Anyone can; an admin places it. A new draft opens on its own label.
 */
export async function saveDraft(_previous: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const { db, user } = await authorize();
  const idText = field(formData, "orderId");
  const orderId = idText ? positiveId(idText) : null;
  if (idText && orderId === null) return { error: { message: "That purchase order doesn't exist." } };

  const fields: Record<string, string> = {};
  let supplierId: number | null = null;
  if (orderId === null) {
    supplierId = positiveId(field(formData, "supplierId"));
    if (supplierId === null) fields.supplierId = "Choose who the order is for.";
  }

  const text = (name: string) => formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
  const [ids, quantities, costs] = [text("productId"), text("quantity"), text("unitCost")];
  const lines: DraftInput["lines"] = [];
  ids.forEach((productText, i) => {
    const productId = positiveId(productText);
    if (productId === null) return;
    const quantity = parseUnits(quantities[i] ?? "");
    const cents = parseCents(costs[i] ?? "");
    if (quantity === null || quantity < 1) fields[`quantity-${productId}`] = "Order 1 unit or more.";
    else if (quantity > MAX_UNITS) fields[`quantity-${productId}`] = `Order ${formatCount(MAX_UNITS)} units or fewer.`;
    if (cents === null) fields[`unitCost-${productId}`] = "Enter the cost in dollars and cents, like 4.50.";
    else if (cents > MAX_COST_CENTS) fields[`unitCost-${productId}`] = "That cost is more than an order can take.";
    lines.push({ productId, quantity: quantity ?? 0, unitCostCents: cents ?? 0 });
  });

  const expectedText = field(formData, "expectedAt").trim();
  const expectedAt = expectedText ? parseDay(expectedText) : undefined;
  if (expectedAt === null) fields.expectedAt = "Enter a date, or leave it empty.";

  if (Object.keys(fields).length > 0 || expectedAt === null) return { fields };
  if (lines.length === 0) return { error: { message: "Add at least one product." } };

  const draft = { notes: field(formData, "notes"), expectedAt, lines };
  let id: number;
  try {
    if (orderId !== null) {
      const { supplierId: kept } = await getOrder(db, orderId);
      await updateDraft(db, user, orderId, { ...draft, supplierId: kept });
      id = orderId;
    } else if (supplierId !== null) {
      ({ id } = await createDraft(db, user, { ...draft, supplierId }));
    } else {
      return { fields: { supplierId: "Choose who the order is for." } };
    }
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field === "expectedAt" || error.field === "notes"
      ? { fields: { [error.field]: error.message } }
      : { error: { message: error.message } };
  }

  if (orderId === null) redirect(`/orders/${id}`);
  refresh();
  return { saved: { id, at: Date.now() } };
}
