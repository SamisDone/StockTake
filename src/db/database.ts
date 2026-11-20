import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

export type Schema = typeof schema;

/**
 * What the domain code needs from a database: the query builder plus an atomic
 * `batch()`. D1 in production and libsql in tests both satisfy it.
 */
export type Database = BaseSQLiteDatabase<"async", unknown, Schema> & {
  batch: LibSQLDatabase<Schema>["batch"];
};
