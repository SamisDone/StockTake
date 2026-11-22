import { readFileSync } from "node:fs";
import type { Client, InStatement } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_OFFSET_MS, DAY_MS, startOfDay } from "@/lib/business-time";
import { resetDemo } from "@/seed/reset";
import { createTestDb, scalar, seedDemo } from "@/test/db";

/** Just enough of D1's binding over libsql for `resetDemo`: prepare, all, and an atomic batch. */
function d1(client: Client) {
  const prepare = (sql: string) => ({
    sql,
    all: async () => ({ results: (await client.execute(sql)).rows }),
  });
  return {
    prepare,
    batch: async (statements: { sql: string }[]) => {
      await client.batch(
        statements.map((s) => s.sql as InStatement),
        "write",
      );
      return [];
    },
  } as unknown as D1Database;
}

const yesterday = new Date(Date.UTC(2026, 10, 19));
// The cron fires at 18:00 UTC, midnight in Dhaka at the start of 21 November.
const firedAt = new Date(Date.UTC(2026, 10, 20, 18));

let client: Client;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await seedDemo(client, yesterday);
});

describe("the nightly demo reset", () => {
  it("fires at midnight on the business's clock", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    const hour = Number(config.match(/"crons":\s*\["0 (\d+) \* \* \*"\]/)?.[1]);
    expect((hour * 60 * 60 * 1000 + BUSINESS_OFFSET_MS) % DAY_MS).toBe(0);
    expect(startOfDay(firedAt).getTime()).toBe(firedAt.getTime());
  });

  it("clears what visitors changed and rebuilds the history up to the new midnight", async () => {
    // A visitor's day: a sale, someone else's account with a session, and the assistant's budget spent.
    await client.execute(
      `INSERT INTO stock_movements (product_id, kind, quantity, user_id, occurred_at) VALUES (1, 'sale', -1, 1, ${firedAt.getTime() - 1000})`,
    );
    await client.execute(
      "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (9, 'visitor@example.com', 'Visitor', 'x', 'staff', 0)",
    );
    await client.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES ('visitor', 9, 9999999999999)");
    await client.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES ('admin', 1, 9999999999999)");
    await client.execute("INSERT INTO assistant_budget (day, neurons) VALUES ('2026-11-20', 120)");

    const result = await resetDemo(d1(client), firedAt);
    expect(result.anchor).toEqual(firedAt);

    const latest = await scalar(client, "SELECT max(occurred_at) FROM stock_movements");
    expect(latest).toBeLessThan(firedAt.getTime());
    expect(latest).toBeGreaterThan(firedAt.getTime() - DAY_MS);
    expect(
      await scalar(
        client,
        `SELECT count(*) FROM products p
         WHERE p.on_hand <> (SELECT coalesce(sum(quantity), 0) FROM stock_movements m WHERE m.product_id = p.id)`,
      ),
    ).toBe(0);
    expect(await scalar(client, "SELECT count(*) FROM users")).toBe(2);
    expect(await scalar(client, "SELECT group_concat(id) FROM sessions")).toBe("admin");
    expect(await scalar(client, "SELECT neurons FROM assistant_budget WHERE day = '2026-11-20'")).toBe(120);
  });

  it("leaves the ledger rules in force", async () => {
    await expect(client.execute("DELETE FROM stock_movements")).rejects.toThrow(/append-only/);
    await expect(client.execute("UPDATE activity_log SET summary = 'x'")).rejects.toThrow(/append-only/);
  });

  it("doesn't start when a rule it must recreate is missing", async () => {
    const before = await scalar(client, "SELECT count(*) FROM stock_movements");
    await client.execute("DROP TRIGGER activity_log_no_update");
    await expect(resetDemo(d1(client), new Date(firedAt.getTime() + DAY_MS))).rejects.toThrow(/missing/);
    expect(await scalar(client, "SELECT count(*) FROM stock_movements")).toBe(before);
  });
});
