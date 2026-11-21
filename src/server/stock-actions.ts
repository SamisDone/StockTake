"use server";

import { refresh } from "next/cache";
import { DomainError } from "@/domain/errors";
import { recordCount, recordStockChange } from "@/domain/stock";
import { parseUnits } from "@/lib/parse";
import { type FormState, field, formError } from "./form-state";
import { authorize } from "./dal";
import { ACTION_COPY } from "./action-copy";

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
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];

  const kind = field(formData, "kind") as StockKind;
  const quantityText = field(formData, "quantity");
  const note = field(formData, "note");
  const values = { kind, quantity: quantityText, note };
  const productId = Number(field(formData, "productId"));

  if (!KINDS.includes(kind)) return { error: { message: t.chooseKind }, values };
  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: { message: t.noProduct }, values };
  }

  const quantity = units(quantityText);
  if (quantity === null || (kind !== "count" && quantity === 0)) {
    const message = kind === "count" ? t.enterCount : t.enterUnits(MAX_UNITS);
    return { error: { message, field: "quantity" }, values };
  }

  let message: string;
  try {
    if (kind === "count") {
      const { difference } = await recordCount(db, user, { productId, counted: quantity, note });
      message = difference === 0 ? t.countMatches(quantity) : t.countAdjusted(quantity, difference);
    } else {
      const { onHand } = await recordStockChange(db, user, { productId, kind, quantity, note });
      message = t.recorded(kind, quantity, onHand);
    }
  } catch (error) {
    // Too few on hand is about the number typed, so it belongs next to that field.
    if (error instanceof DomainError && error.code === "insufficient_stock") {
      return { error: { message: error.in(language), field: "quantity" }, values };
    }
    return formError(error, language, values);
  }

  refresh();
  return { done: { message, at: Date.now() }, values: { kind } };
}
