"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { cancelOrder, getOrder, placeOrder, poNumber, receiveOrder } from "@/domain/purchase-orders";
import { draftSuggestedOrder } from "@/domain/reorder";
import { formatCount } from "@/lib/format";
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
