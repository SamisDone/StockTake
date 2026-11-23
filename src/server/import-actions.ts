"use server";

import { refresh } from "next/cache";
import { said, sayIn } from "@/domain/error-copy";
import { DomainError } from "@/domain/errors";
import {
  IMPORT_MAX_BYTES,
  type ImportColumn,
  type ImportPlan,
  type PlannedRow,
  importProducts,
  importTally,
  planImport,
} from "@/domain/product-import";
import type { Language } from "@/lib/i18n";
import { authorize } from "./dal";

/** A plan as the import screen prints it: problems said in the reader's language. */
export type ImportCheck = {
  rows: PlannedRow[];
  problems: { line: number | null; column: ImportColumn | null; message: string }[];
  newSuppliers: string[];
  ignored: string[];
  tally: ReturnType<typeof importTally>;
};

export type ImportResult = { ok: true; check: ImportCheck; written: boolean } | { ok: false; message: string };

const shown = (plan: ImportPlan, language: Language): ImportCheck => ({
  rows: plan.rows,
  problems: plan.problems.map((p) => ({ line: p.line, column: p.column, message: sayIn(language, p.said) })),
  newSuppliers: plan.newSuppliers,
  ignored: plan.ignored,
  tally: importTally(plan),
});

/** A file's text, if it's text and small enough to read; the browser checks the size first too. */
function readable(text: unknown): text is string {
  return typeof text === "string" && text.length <= IMPORT_MAX_BYTES;
}

/** Reads a products file against the catalog and says what importing it would do. Writes nothing. */
export async function checkImport(text: unknown): Promise<ImportResult> {
  const { db, user, language } = await authorize();
  if (user.role !== "admin")
    return { ok: false, message: sayIn(language, said("adminOnly", { action: "importProducts" })) };
  if (!readable(text)) return { ok: false, message: sayIn(language, said("importTooLarge")) };
  return { ok: true, check: shown(await planImport(db, text), language), written: false };
}

/**
 * Imports a products file: checks it again against the catalog as it is now and writes
 * it whole, or hands back what's wrong with it.
 */
export async function runImport(text: unknown): Promise<ImportResult> {
  const { db, user, language } = await authorize();
  if (!readable(text)) return { ok: false, message: sayIn(language, said("importTooLarge")) };
  try {
    const { plan, written } = await importProducts(db, user, text);
    if (written) refresh();
    return { ok: true, check: shown(plan, language), written };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.in(language) };
    throw error;
  }
}
