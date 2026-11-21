import { getTableColumns, getTableName, sql, type Table } from "drizzle-orm";
import { z } from "zod";

/** Optional free text: trimmed, and blank becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || undefined);

export const id = z.number().int().positive();
export const cents = z.number().int().min(0, "notNegative").max(100_000_000, "moneyTooLarge");
export const wholeUnits = z.number().int().min(0, "notNegative").max(1_000_000, "quantityTooLarge");

/**
 * A LIKE pattern matching `query` anywhere, with % and _ taken literally. Use it with
 * `ESCAPE '!'`, which avoids backslash-escaping between JavaScript and SQL.
 */
export const containsPattern = (query: string) => `%${query.replace(/[!%_]/g, "!$&")}%`;

/**
 * A column written as "table"."column". Drizzle leaves out the table name when a query
 * has no joins, so a correlated subquery that points at the outer table needs this:
 * otherwise "id" resolves to the subquery's own table.
 */
export function outer<T extends Table>(table: T, key: keyof T["_"]["columns"] & string) {
  const column = getTableColumns(table)[key];
  return sql`${sql.identifier(getTableName(table))}.${sql.identifier(column.name)}`;
}
