"use server";

import { refresh } from "next/cache";
import { DomainError } from "@/domain/errors";
import { recordCount, recordStockChange } from "@/domain/stock";
import { formatChange, formatCount } from "@/lib/format";
import { parseUnits } from "@/lib/parse";
import { type FormState, field, formError } from "./form-state";
import { authorize } from "./dal";

export type StockKind = "count" | "sale" | "return" | "write_off";
const KINDS: StockKind[] = ["count", "sale", "return", "write_off"];

/** What the record-stock form gets back: an error, or what was recorded. */
export type StockFormState = FormState & {
  /** Set after a successful write. `at` changes on every write, so the form can reset. */
  done?: { message: string; at: number };
};

const MAX_UNITS = 1_000_000;

/** A whole number of units typed by a person, up to the most one entry can move. */
function units(text: string) {
  const n = parseUnits(text);
  return n !== null && n <= MAX_UNITS ? n : null;
}

/**
 * Records a count, sale, return or write-off from a product's label. Any signed-in
 * person can record stock; the ledger rules in the database have the last word.
 */
export async function recordStock(_previous: StockFormState, formData: FormData): Promise<StockFormState> {
  const { db, user } = await authorize();

  const kind = field(formData, "kind") as StockKind;
  const quantityText = field(formData, "quantity");
  const note = field(formData, "note");
  const values = { kind, quantity: quantityText, note };
  const productId = Number(field(formData, "productId"));

  if (!KINDS.includes(kind)) return { error: { message: "Choose what you're recording." }, values };
  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: { message: "That product doesn't exist." }, values };
  }

  const quantity = units(quantityText);
  if (quantity === null || (kind !== "count" && quantity === 0)) {
    const message =
      kind === "count"
        ? "Enter the number you counted on the shelf, as a whole number."
        : `Enter how many units, as a whole number from 1 to ${formatCount(MAX_UNITS)}.`;
    return { error: { message, field: "quantity" }, values };
  }

  let message: string;
  try {
    if (kind === "count") {
      const { difference } = await recordCount(db, user, { productId, counted: quantity, note });
      message =
        difference === 0
          ? `Counted ${formatCount(quantity)}, which matches.`
          : `Counted ${formatCount(quantity)}, so the ledger was adjusted by ${formatChange(difference)}.`;
    } else {
      const { onHand } = await recordStockChange(db, user, { productId, kind, quantity, note });
      const what = { sale: "a sale", return: "a return", write_off: "a write-off" }[kind];
      message = `Recorded ${what} of ${formatCount(quantity)}. ${formatCount(onHand)} on hand.`;
    }
  } catch (error) {
    // Too few on hand is about the number typed, so it belongs next to that field.
    if (error instanceof DomainError && error.code === "insufficient_stock") {
      return { error: { message: error.message, field: "quantity" }, values };
    }
    return formError(error, values);
  }

  refresh();
  return { done: { message, at: Date.now() }, values: { kind } };
}
