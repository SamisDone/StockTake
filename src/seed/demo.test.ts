import { readFileSync } from "node:fs";
import type { Client } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { authenticate } from "@/domain/auth";
import { getStockForecasts } from "@/domain/forecast";
import { DEMO_PASSWORD, DEMO_USERS, demoPasswordHash, demoStatements, resetStatements } from "@/seed/demo";
import { createTestDb, scalar } from "@/test/db";

const anchor = new Date(Date.UTC(2026, 10, 20));
const rules = readFileSync("drizzle/0001_ledger_rules.sql", "utf8");

let client: Client;
let db: Database;
let passwordHash: string;

async function seed() {
  const sql = [...resetStatements(rules), ...demoStatements({ anchor, passwordHash })].join("\n");
  await client.executeMultiple(sql);
}

const count = (table: string) => scalar(client, `SELECT count(*) FROM ${table}`);

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  passwordHash = await demoPasswordHash();
  await seed();
});

describe("demo seed", () => {
  it("loads through every ledger trigger", async () => {
    expect(await count("users")).toBe(2);
    expect(await count("suppliers")).toBe(6);
    expect(await count("products")).toBe(30);
    expect(await count("supplier_reviews")).toBe(9);
    expect(await count("purchase_orders")).toBeGreaterThan(20);
    expect(await count("stock_movements")).toBeGreaterThan(2000);
  });

  it("keeps every product's stock equal to its ledger", async () => {
    const drift = await scalar(
      client,
      `SELECT count(*) FROM products p
       WHERE p.on_hand <> (SELECT coalesce(sum(quantity), 0) FROM stock_movements m WHERE m.product_id = p.id)`,
    );
    expect(drift).toBe(0);
  });

  it("includes an order in every status", async () => {
    const result = await client.execute("SELECT DISTINCT status FROM purchase_orders ORDER BY status");
    expect(result.rows.map((row) => row.status)).toEqual(["cancelled", "draft", "ordered", "received"]);
  });

  it("leaves a few products needing attention and most healthy", async () => {
    const forecasts = await getStockForecasts(db, anchor);
    const flagged = forecasts.filter((f) => f.status !== "ok");
    expect(flagged.length).toBeGreaterThanOrEqual(3);
    expect(flagged.length).toBeLessThan(forecasts.length / 2);
  });

  it("timestamps nothing after the anchor", async () => {
    expect(await scalar(client, "SELECT max(occurred_at) FROM stock_movements")).toBeLessThan(anchor.getTime());
    expect(await scalar(client, "SELECT max(occurred_at) FROM activity_log")).toBeLessThan(anchor.getTime());
  });

  it("signs in both demo people with the published password", async () => {
    for (const user of DEMO_USERS) {
      expect(await authenticate(db, user.email, DEMO_PASSWORD)).toMatchObject({ id: user.id, role: user.role });
    }
  });

  it("is deterministic", () => {
    expect(demoStatements({ anchor, passwordHash })).toEqual(demoStatements({ anchor, passwordHash }));
  });

  it("can be run again over an existing dataset", async () => {
    const before = await count("stock_movements");
    await seed();
    expect(await count("stock_movements")).toBe(before);
    // The append-only rules are back in force afterwards.
    await expect(client.execute("DELETE FROM stock_movements")).rejects.toThrow(/append-only/);
  });
});
