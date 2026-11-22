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
import { parseCents, parseUnits } from "@/lib/parse";
import { authorize } from "./dal";
import { type FormState, field, formError } from "./form-state";
import { ACTION_COPY } from "./action-copy";
import { parseDayKey } from "@/lib/business-time";

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
  const { db, user, language } = await authorize();
  const supplierId = positiveId(field(formData, "supplierId"));
  if (supplierId === null) return { error: { message: ACTION_COPY[language].noSupplier } };

  let id: number;
  try {
    ({ id } = await draftSuggestedOrder(db, user, supplierId));
  } catch (error) {
    return formError(error, language);
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
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const orderId = positiveId(field(formData, "orderId"));
  const intent = field(formData, "intent") as Intent;
  if (!INTENTS.includes(intent)) return { error: { message: t.chooseIntent } };
  if (orderId === null) return { error: { message: t.noOrder } };

  let message: string;
  try {
    if (intent === "place") {
      await placeOrder(db, user, orderId);
      const order = await getOrder(db, orderId);
      message = t.placed(order.number, order.supplierName);
    } else if (intent === "cancel") {
      await cancelOrder(db, user, orderId);
      message = t.cancelled(poNumber(orderId));
    } else {
      await receiveOrder(db, user, orderId);
      const order = await getOrder(db, orderId);
      const units = order.lines.reduce((total, line) => total + line.quantity, 0);
      message = t.received(order.number, units);
    }
  } catch (error) {
    return formError(error, language);
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

/**
 * Writes a draft by hand: a new order when the form names a supplier, or a draft's
 * new lines, notes and expected date when it carries the order's ID (its supplier
 * stays). Anyone can; an admin places it. A new draft opens on its own label.
 */
export async function saveDraft(_previous: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const idText = field(formData, "orderId");
  const orderId = idText ? positiveId(idText) : null;
  if (idText && orderId === null) return { error: { message: t.noOrder } };

  const fields: Record<string, string> = {};
  let supplierId: number | null = null;
  if (orderId === null) {
    supplierId = positiveId(field(formData, "supplierId"));
    if (supplierId === null) fields.supplierId = t.chooseSupplier;
  }

  const text = (name: string) => formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
  const [ids, quantities, costs] = [text("productId"), text("quantity"), text("unitCost")];
  const lines: DraftInput["lines"] = [];
  ids.forEach((productText, i) => {
    const productId = positiveId(productText);
    if (productId === null) return;
    const quantity = parseUnits(quantities[i] ?? "");
    const cents = parseCents(costs[i] ?? "");
    if (quantity === null || quantity < 1) fields[`quantity-${productId}`] = t.orderAtLeastOne;
    else if (quantity > MAX_UNITS) fields[`quantity-${productId}`] = t.orderAtMost(MAX_UNITS);
    if (cents === null) fields[`unitCost-${productId}`] = t.enterCost;
    else if (cents > MAX_COST_CENTS) fields[`unitCost-${productId}`] = t.costTooLarge;
    lines.push({ productId, quantity: quantity ?? 0, unitCostCents: cents ?? 0 });
  });

  const expectedText = field(formData, "expectedAt").trim();
  // A date input's day ("2026-11-28") is stored as the business's midnight it begins at.
  const expectedAt = expectedText ? parseDayKey(expectedText) : undefined;
  if (expectedAt === null) fields.expectedAt = t.enterDate;

  if (Object.keys(fields).length > 0 || expectedAt === null) return { fields };
  if (lines.length === 0) return { error: { message: t.addProduct } };

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
      return { fields: { supplierId: t.chooseSupplier } };
    }
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field === "expectedAt" || error.field === "notes"
      ? { fields: { [error.field]: error.in(language) } }
      : { error: { message: error.in(language) } };
  }

  if (orderId === null) redirect(`/orders/${id}`);
  refresh();
  return { saved: { id, at: Date.now() } };
}

/** What a proposal's form gets back: why it couldn't be written, or the draft it became. */
export type ProposalFormState = { error?: { message: string }; saved?: { id: number; number: string } };

/**
 * Writes a draft from a proposal the assistant made, once the person confirms it. Lines
 * arrive as `productId` and `quantity` pairs; costs are each product's current cost.
 * The domain checks it all again (the supplier's own active products, sane quantities),
 * so the proposal is only ever a starting point. It doesn't redirect: the Ask page marks
 * the proposal as written, then opens the draft.
 */
export async function draftFromProposal(_previous: ProposalFormState, formData: FormData): Promise<ProposalFormState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const supplierId = positiveId(field(formData, "supplierId"));
  if (supplierId === null) return { error: { message: t.noSupplier } };

  const ids = formData.getAll("productId");
  const quantities = formData.getAll("quantity");
  const lines: DraftInput["lines"] = [];
  for (const [i, raw] of ids.entries()) {
    const productId = typeof raw === "string" ? positiveId(raw) : null;
    const quantity = parseUnits(String(quantities[i] ?? ""));
    if (productId === null || quantity === null || quantity < 1 || quantity > MAX_UNITS) {
      return { error: { message: t.proposalStale } };
    }
    lines.push({ productId, quantity });
  }
  if (lines.length === 0) return { error: { message: t.proposalEmpty } };

  try {
    const { id } = await createDraft(db, user, { supplierId, notes: "Proposed in Ask.", lines });
    return { saved: { id, number: poNumber(id) } };
  } catch (error) {
    return formError(error, language);
  }
}
