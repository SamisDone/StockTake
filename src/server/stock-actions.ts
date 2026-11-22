"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { recordCount, recordStockChange, undoMovement } from "@/domain/stock";
import { parseUnits } from "@/lib/parse";
import { type FormState, field, formError } from "./form-state";
import { authorize } from "./dal";
import { ledgerPage } from "./ledger";
import { ACTION_COPY } from "./action-copy";

export type StockKind = "count" | "sale" | "return" | "write_off";
const KINDS: StockKind[] = ["count", "sale", "return", "write_off"];

/** What the record-stock form gets back: an error, or what was recorded. */
export type StockFormState = FormState & {
  /**
   * Set after a successful write. `at` changes on every write, so the form can reset.
   * `movementId` is the line written, for Undo; null when a count matched and wrote none.
   */
  done?: { message: string; at: number; productId: number; movementId: number | null };
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
  let movementId: number | null;
  try {
    if (kind === "count") {
      const count = await recordCount(db, user, { productId, counted: quantity, note });
      movementId = count.movementId;
      message =
        count.difference === 0
          ? t.countMatches(count.name, quantity)
          : t.countAdjusted(count.name, quantity, count.difference);
    } else {
      const change = await recordStockChange(db, user, { productId, kind, quantity, note });
      movementId = change.movementId;
      message = t.recorded(change.name, kind, quantity, change.onHand);
    }
  } catch (error) {
    // Too few on hand is about the number typed, so it belongs next to that field.
    if (error instanceof DomainError && error.code === "insufficient_stock") {
      return { error: { message: error.in(language), field: "quantity" }, values };
    }
    return formError(error, language, values);
  }

  refresh();
  return { done: { message, at: Date.now(), productId, movementId }, values: { kind } };
}

/** What Undo gets back: what the ledger says now, or why the line can't be undone. */
export type UndoResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Undoes a line the person just recorded (the toast's Undo): the ledger gains its exact
 * reverse, so the history still shows both. Refused, it says why in the reader's words.
 */
export async function undoStock(movementId: number): Promise<UndoResult> {
  const { db, user, language } = await authorize();
  try {
    const { name, onHand } = await undoMovement(db, user, movementId);
    refresh();
    return { ok: true, message: ACTION_COPY[language].undone(name, onHand) };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.in(language) };
    throw error;
  }
}

const cursorInput = z.object({
  productId: z.number().int().positive(),
  occurredAt: z.number().int().nonnegative(),
  id: z.number().int().positive(),
});

/**
 * The next page of a product's ledger, older than the last movement shown. Anyone signed
 * in can read a ledger; a malformed cursor reads as nothing more to show.
 */
export async function olderMovements(raw: { productId: number; occurredAt: number; id: number }) {
  const { db } = await authorize();
  const parsed = cursorInput.safeParse(raw);
  if (!parsed.success) return [];
  const { productId, occurredAt, id } = parsed.data;
  return ledgerPage(db, productId, { occurredAt: new Date(occurredAt), id });
}
