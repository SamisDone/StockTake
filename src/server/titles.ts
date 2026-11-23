import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, products, suppliers } from "@/db/schema";
import { getSessionUser } from "./dal";

const ID = /^\d{1,9}$/;

/**
 * The name of the record a page shows, for the browser tab: "20 W wall charger ·
 * Stocktake" rather than "Product · Stocktake". Metadata renders apart from the page, so
 * this checks the session itself and names nothing for someone signed out (or for an ID
 * that doesn't exist); the page's own check still decides what they see.
 */
export async function recordName(kind: "product" | "supplier" | "customer", rawId: string): Promise<string | null> {
  if (!ID.test(rawId) || !(await getSessionUser())) return null;
  const table = kind === "product" ? products : kind === "supplier" ? suppliers : customers;
  const db = await getDb();
  const [row] = await db
    .select({ name: table.name })
    .from(table)
    .where(eq(table.id, Number(rawId)));
  return row?.name ?? null;
}
