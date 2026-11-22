import { sql } from "drizzle-orm";
import { stockMovements } from "@/db/schema";
import { outer } from "./input";

const reverses = outer(stockMovements, "reversesId");

/**
 * A movement's kind as the ledger is summed: its own, or for an undo, the kind of the
 * line it reverses. An undone sale then nets out of sales (and demand) instead of
 * showing up as a count adjustment. SQLite evaluates the CASE lazily, so the lookup
 * runs only for the rare undo. Columns are named with their table, so inside the
 * lookup they still mean the row being summed, not the line looked up.
 */
export const countedKind = sql`(CASE WHEN ${reverses} IS NULL THEN ${outer(stockMovements, "kind")} ELSE (SELECT o.kind FROM ${stockMovements} o WHERE o.id = ${reverses}) END)`;
