import type { Client } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { createDraft, placeOrder, receiveOrder } from "@/domain/purchase-orders";
import { recordStockChange } from "@/domain/stock";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";
import { ON_HAND_STATEMENT, onHandStatement, REFUSALS } from "./refusals";

// The landing page quotes these refusals. Each SQL statement runs against the real
// migrations, in a state where the ids it names exist, and must fail with exactly the
// message the page prints.
let client: Client;
let db: Database;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  await seedBasics(db);
  // Purchase order 1 with line 1 (50 widgets), placed and received: movement 1.
  const order = await createDraft(db, admin, { supplierId: 1, lines: [{ productId: 1, quantity: 50 }] });
  await placeOrder(db, admin, order.id);
  await receiveOrder(db, staff, order.id);
  // A sale of 5 widgets: movement 2.
  await recordStockChange(db, staff, { productId: 1, kind: "sale", quantity: 5 });
});

describe("the refusals on the landing page", () => {
  it.each(REFUSALS)("$attempt.en → $refusal", async ({ sql, refusal }) => {
    const error = await client.execute(sql).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error, "the database accepted a write the landing page says it refuses").toBeInstanceOf(Error);
    expect(String((error as Error).message)).toContain(refusal);
  });

  // The landing page lets a visitor type any whole number into the first statement and
  // answers with the same refusal; only the ledger's own total goes through, unchanged.
  it.each(["0", "1", "44", "46", "500", "9999999"])("on_hand = %s → the same refusal", async (value) => {
    const error = await client.execute(onHandStatement(value)).then(
      () => null,
      (e: unknown) => e,
    );
    expect(String((error as Error | null)?.message)).toContain(REFUSALS[0].refusal);
  });

  it("accepts the ledger's own total, changing nothing", async () => {
    await client.execute(onHandStatement(String(ON_HAND_STATEMENT.onHand)));
  });

  it("leaves the data exactly as it was", async () => {
    const onHand = await client.execute("SELECT on_hand FROM products WHERE sku = 'WID-001'");
    expect(onHand.rows[0][0]).toBe(ON_HAND_STATEMENT.onHand);
  });
});
