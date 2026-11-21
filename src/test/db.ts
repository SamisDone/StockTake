import { readFileSync, readdirSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "@/db/database";
import * as schema from "@/db/schema";

/**
 * A fresh in-memory database with every migration in drizzle/ applied, the same SQL
 * that `wrangler d1 migrations apply` runs against D1. D1 always enforces foreign
 * keys; SQLite needs the pragma.
 */
export async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { client, db: db as Database };
}

export async function scalar<T = number>(client: Client, sql: string, args: unknown[] = []) {
  const result = await client.execute({ sql, args: args as never });
  return result.rows[0]?.[0] as T;
}

/** Every migration's SQL, in order, the way scripts/seed.mts hands it to `resetStatements`. */
export function migrationsSql() {
  return readdirSync("drizzle")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(`drizzle/${name}`, "utf8"))
    .join("\n");
}
