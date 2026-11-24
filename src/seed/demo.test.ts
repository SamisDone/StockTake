import type { Client } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { authenticate } from "@/domain/auth";
import { listActivity } from "@/domain/activity";
import { activityText } from "@/domain/activity-copy";
import { getAnalytics, getStockTrail } from "@/domain/analytics";
import { getStockForecasts } from "@/domain/forecast";
import { DEMO_PASSWORD_HASH } from "@/seed/accounts";
import { DEMO_PASSWORD, DEMO_USERS, demoPasswordHash, demoStatements } from "@/seed/demo";
import { createTestDb, scalar, seedDemo } from "@/test/db";
import { ASK_COPY } from "@/app/(app)/ask/copy";

const anchor = new Date(Date.UTC(2026, 10, 20));

let client: Client;
let db: Database;

const seed = () => seedDemo(client, anchor);
const count = (table: string) => scalar(client, `SELECT count(*) FROM ${table}`);

beforeAll(async () => {
  ({ client, db } = await createTestDb());
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

  it("gives the dashboard the same stock line as analytics", async () => {
    const now = new Date(anchor.getTime() + 10 * 60 * 60 * 1000);
    const { stock, stockByDay } = await getAnalytics(db, 28, now);
    expect(await getStockTrail(db, 28, now)).toEqual({ openingCents: stock.opening.costCents, days: stockByDay });
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

  it("writes the published password's hash, precomputed", async () => {
    expect(DEMO_PASSWORD_HASH).toBe(await demoPasswordHash());
  });

  it("writes every activity entry's facts, which say what its summary says", async () => {
    const entries = await listActivity(db, { limit: 100_000 });
    expect(entries.length).toBeGreaterThan(100);
    for (const entry of entries) {
      expect(entry.facts, entry.summary).not.toBeNull();
      expect(activityText("en", entry)).toBe(entry.summary);
    }
  });

  it("folds rows into a few hundred statements, each well inside D1's 100 KB", () => {
    const statements = demoStatements({ anchor });
    expect(statements.length).toBeLessThan(1000);
    const encoder = new TextEncoder();
    for (const sql of statements) expect(encoder.encode(sql).length).toBeLessThan(100_000);
  });

  it("has the supplier the Ask page's example question names", async () => {
    const names = (await client.execute("SELECT name FROM suppliers")).rows.map((row) => String(row.name));
    for (const language of ["en", "bn"] as const) {
      const example = ASK_COPY[language].placeholder;
      expect(
        names.some((name) => example.includes(name)),
        example,
      ).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(demoStatements({ anchor })).toEqual(demoStatements({ anchor }));
  });

  it("can be run again over an existing dataset", async () => {
    const before = await count("stock_movements");
    await seed();
    expect(await count("stock_movements")).toBe(before);
    // The append-only rules are back in force afterwards.
    await expect(client.execute("DELETE FROM stock_movements")).rejects.toThrow(/append-only/);
  });
});
