import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import type { Database } from "./database";
import * as schema from "./schema";

/** The request's D1 database. Call it from server code only, after the session check. */
export async function getDb(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
