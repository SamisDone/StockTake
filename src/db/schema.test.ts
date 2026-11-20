import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, scalar } from "@/test/db";

const T0 = 1_763_600_000_000;

let client: Client;

async function run(sql: string, args: unknown[] = []) {
  return client.execute({ sql, args: args as never });
}

async function onHand(productId: number) {
  return scalar(client, "SELECT on_hand FROM products WHERE id = ?", [productId]);
}

/** One admin, one supplier, two products with no stock. */
async function seedBasics() {
  await run(
    "INSERT INTO users (id, email, name, password_hash, role) VALUES (1, 'ada@example.com', 'Ada', 'x', 'admin')",
  );
  await run("INSERT INTO suppliers (id, name, lead_time_days) VALUES (1, 'Northwind', 7)");
  await run(
    `INSERT INTO products (id, sku, name, supplier_id, unit_cost_cents, unit_price_cents, reorder_point, reorder_quantity)
     VALUES (1, 'WID-001', 'Widget', 1, 250, 900, 10, 50),
            (2, 'GAD-002', 'Gadget', 1, 400, 1500, 5, 20)`,
  );
}

async function move(productId: number, kind: string, quantity: number, lineId: number | null = null) {
  return run(
    `INSERT INTO stock_movements (product_id, kind, quantity, purchase_order_line_id, user_id, occurred_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [productId, kind, quantity, lineId, T0],
  );
}

/** A draft order for 30 widgets (line 1) and 10 gadgets (line 2). */
async function draftOrder() {
  await run("INSERT INTO purchase_orders (id, supplier_id, status, created_by) VALUES (1, 1, 'draft', 1)");
  await run(
    `INSERT INTO purchase_order_lines (id, purchase_order_id, product_id, quantity, unit_cost_cents)
     VALUES (1, 1, 1, 30, 250), (2, 1, 2, 10, 400)`,
  );
}

async function placeOrder() {
  await run("UPDATE purchase_orders SET status = 'ordered', ordered_at = ? WHERE id = 1", [T0]);
}

const receiveOrder = () =>
  client.batch(
    [
      {
        sql: `INSERT INTO stock_movements (product_id, kind, quantity, purchase_order_line_id, user_id, occurred_at)
              VALUES (1, 'receipt', 30, 1, 1, ?), (2, 'receipt', 10, 2, 1, ?)`,
        args: [T0, T0],
      },
      { sql: "UPDATE purchase_orders SET status = 'received', received_at = ? WHERE id = 1", args: [T0] },
    ],
    "write",
  );

beforeEach(async () => {
  ({ client } = await createTestDb());
  await seedBasics();
});

describe("stock ledger", () => {
  it("applies each movement to the product's on-hand count", async () => {
    await move(1, "adjustment", 12);
    await move(1, "sale", -5);
    await move(1, "return", 1);
    await move(1, "write_off", -2);
    expect(await onHand(1)).toBe(6);
  });

  it("rejects a movement that would take stock below zero and records nothing", async () => {
    await move(1, "adjustment", 3);
    await expect(move(1, "sale", -4)).rejects.toThrow(/products_on_hand_nonnegative/);
    expect(await onHand(1)).toBe(3);
    expect(await scalar(client, "SELECT count(*) FROM stock_movements")).toBe(1);
  });

  it.each([
    ["sale", 2],
    ["write_off", 1],
    ["return", -1],
    ["adjustment", 0],
  ])("rejects a %s with quantity %d", async (kind, quantity) => {
    await move(1, "adjustment", 10);
    await expect(move(1, kind, quantity)).rejects.toThrow(/stock_movements_quantity_sign/);
  });

  it("rejects an unknown movement kind", async () => {
    await expect(move(1, "theft", -1)).rejects.toThrow(/stock_movements_kind/);
  });

  it("rejects a receipt that is not tied to an order line", async () => {
    await expect(move(1, "receipt", 5)).rejects.toThrow(/stock_movements_receipt_line/);
  });

  it("refuses to create a product with stock already on hand", async () => {
    await expect(
      run("INSERT INTO products (sku, name, unit_cost_cents, unit_price_cents, on_hand) VALUES ('X-1', 'X', 1, 1, 5)"),
    ).rejects.toThrow(/on_hand starts at zero/);
  });

  it("refuses direct edits to on_hand that bypass the ledger", async () => {
    await move(1, "adjustment", 4);
    await expect(run("UPDATE products SET on_hand = 99 WHERE id = 1")).rejects.toThrow(
      /on_hand must match the stock ledger/,
    );
    expect(await onHand(1)).toBe(4);
  });

  it("still allows other product edits", async () => {
    await move(1, "adjustment", 4);
    await run("UPDATE products SET name = 'Widget Pro', reorder_point = 8 WHERE id = 1");
    expect(await scalar(client, "SELECT name FROM products WHERE id = 1")).toBe("Widget Pro");
  });

  it("keeps movements append-only", async () => {
    await move(1, "adjustment", 4);
    await expect(run("UPDATE stock_movements SET quantity = 40")).rejects.toThrow(/append-only/);
    await expect(run("DELETE FROM stock_movements")).rejects.toThrow(/append-only/);
  });

  it("rejects a movement for a product that does not exist", async () => {
    await expect(move(999, "adjustment", 1)).rejects.toThrow(/FOREIGN KEY/);
  });

  it("refuses to delete a product that has stock history", async () => {
    await move(1, "adjustment", 1);
    await expect(run("DELETE FROM products WHERE id = 1")).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe("purchase orders", () => {
  beforeEach(draftOrder);

  it("moves draft → ordered → received", async () => {
    await placeOrder();
    await receiveOrder();
    expect(await scalar(client, "SELECT status FROM purchase_orders WHERE id = 1")).toBe("received");
    expect(await onHand(1)).toBe(30);
    expect(await onHand(2)).toBe(10);
  });

  /** Sets a status together with the timestamps that status requires. */
  const setStatus = (status: string) =>
    run(
      `UPDATE purchase_orders SET status = ?1,
         ordered_at = CASE WHEN ?1 IN ('ordered', 'received') THEN coalesce(ordered_at, ?2) ELSE ordered_at END,
         received_at = CASE WHEN ?1 = 'received' THEN ?2 END,
         cancelled_at = CASE WHEN ?1 = 'cancelled' THEN ?2 END
       WHERE id = 1`,
      [status, T0],
    );

  async function reach(status: string) {
    if (status === "ordered" || status === "received") await placeOrder();
    if (status === "received") await receiveOrder();
    if (status === "cancelled") await setStatus("cancelled");
  }

  it.each([
    ["draft", "received"],
    ["ordered", "draft"],
    ["received", "cancelled"],
    ["received", "ordered"],
    ["cancelled", "ordered"],
    ["cancelled", "draft"],
  ])("rejects the transition %s → %s", async (from, to) => {
    await reach(from);
    await expect(setStatus(to)).rejects.toThrow(/purchase order cannot move from/);
  });

  it.each(["draft", "ordered"])("allows cancelling a %s order", async (from) => {
    await reach(from);
    await setStatus("cancelled");
    expect(await scalar(client, "SELECT status FROM purchase_orders WHERE id = 1")).toBe("cancelled");
  });

  it("requires the timestamp that matches each status", async () => {
    await expect(run("UPDATE purchase_orders SET status = 'ordered' WHERE id = 1")).rejects.toThrow(
      /purchase_orders_status_timestamps/,
    );
  });

  it("rejects an unknown status", async () => {
    await expect(
      run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (1, 'shipped', 1)"),
    ).rejects.toThrow(/SQLITE_CONSTRAINT/);
    await expect(run("UPDATE purchase_orders SET status = 'shipped' WHERE id = 1")).rejects.toThrow(
      /SQLITE_CONSTRAINT/,
    );
  });

  it("only creates new orders as drafts", async () => {
    await expect(
      run("INSERT INTO purchase_orders (supplier_id, status, ordered_at, created_by) VALUES (1, 'ordered', ?, 1)", [
        T0,
      ]),
    ).rejects.toThrow(/new purchase orders start as drafts/);
  });

  it("requires a positive line quantity", async () => {
    await expect(
      run(
        "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 1, 0, 250)",
      ),
    ).rejects.toThrow(/purchase_order_lines_quantity_positive/);
  });

  it("allows one line per product on an order", async () => {
    await expect(
      run(
        "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 1, 5, 250)",
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("locks the lines once the order is placed", async () => {
    await placeOrder();
    await expect(run("UPDATE purchase_order_lines SET quantity = 99 WHERE id = 1")).rejects.toThrow(
      /lines can only change while the order is a draft/,
    );
    await expect(run("DELETE FROM purchase_order_lines WHERE id = 1")).rejects.toThrow(
      /lines can only change while the order is a draft/,
    );
    await expect(
      run(
        "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 1, 5, 250)",
      ),
    ).rejects.toThrow(/lines can only change while the order is a draft/);
  });

  it("refuses to place an order with no lines", async () => {
    await run("DELETE FROM purchase_order_lines WHERE purchase_order_id = 1");
    await expect(placeOrder()).rejects.toThrow(/an order needs at least one line/);
  });

  it("rejects a receipt against an order that has not been placed", async () => {
    await expect(move(1, "receipt", 30, 1)).rejects.toThrow(/only placed orders can be received/);
  });

  it("rejects a receipt whose product or quantity differs from its line", async () => {
    await placeOrder();
    await expect(move(1, "receipt", 29, 1)).rejects.toThrow(/receipt must match its order line/);
    await expect(move(2, "receipt", 30, 1)).rejects.toThrow(/receipt must match its order line/);
  });

  it("refuses to mark an order received while a line has no receipt", async () => {
    await placeOrder();
    await move(1, "receipt", 30, 1);
    await expect(
      run("UPDATE purchase_orders SET status = 'received', received_at = ? WHERE id = 1", [T0]),
    ).rejects.toThrow(/every line needs a receipt/);
  });

  it("fails atomically when the same order is received twice", async () => {
    await placeOrder();
    await receiveOrder();
    await expect(receiveOrder()).rejects.toThrow();
    expect(await onHand(1)).toBe(30);
    expect(await onHand(2)).toBe(10);
    expect(await scalar(client, "SELECT count(*) FROM stock_movements")).toBe(2);
  });

  it("never receives an order line twice, even split across movements", async () => {
    await placeOrder();
    await move(1, "receipt", 30, 1);
    await expect(move(1, "receipt", 30, 1)).rejects.toThrow(/UNIQUE/);
  });
});

describe("suppliers", () => {
  it("keeps ratings between 1 and 5", async () => {
    for (const rating of [0, 6]) {
      await expect(
        run("INSERT INTO supplier_reviews (supplier_id, user_id, rating) VALUES (1, 1, ?)", [rating]),
      ).rejects.toThrow(/supplier_reviews_rating_range/);
    }
  });

  it("allows one review per person per supplier", async () => {
    await run("INSERT INTO supplier_reviews (supplier_id, user_id, rating) VALUES (1, 1, 4)");
    await expect(run("INSERT INTO supplier_reviews (supplier_id, user_id, rating) VALUES (1, 1, 2)")).rejects.toThrow(
      /UNIQUE/,
    );
  });
});

describe("users and sessions", () => {
  it("stores emails in lowercase", async () => {
    await expect(
      run("INSERT INTO users (email, name, password_hash, role) VALUES ('Bob@Example.com', 'Bob', 'x', 'staff')"),
    ).rejects.toThrow(/users_email_lowercase/);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      run("INSERT INTO users (email, name, password_hash, role) VALUES ('ada@example.com', 'Ada 2', 'x', 'staff')"),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("only knows the admin and staff roles", async () => {
    await expect(
      run("INSERT INTO users (email, name, password_hash, role) VALUES ('eve@example.com', 'Eve', 'x', 'owner')"),
    ).rejects.toThrow(/users_role/);
  });

  it("drops a user's sessions when the user is deleted", async () => {
    await run(
      "INSERT INTO users (id, email, name, password_hash, role) VALUES (2, 'bo@example.com', 'Bo', 'x', 'staff')",
    );
    await run("INSERT INTO sessions (id, user_id, expires_at) VALUES ('hash', 2, ?)", [T0]);
    await run("DELETE FROM users WHERE id = 2");
    expect(await scalar(client, "SELECT count(*) FROM sessions")).toBe(0);
  });

  it("stores SKUs in uppercase", async () => {
    await expect(
      run("INSERT INTO products (sku, name, unit_cost_cents, unit_price_cents) VALUES ('wid-9', 'W', 1, 1)"),
    ).rejects.toThrow(/products_sku_uppercase/);
  });
});

describe("archived products", () => {
  const archive = (id: number) => run("UPDATE products SET archived_at = ? WHERE id = ?", [T0, id]);

  it("can't take stock movements while archived", async () => {
    await move(1, "adjustment", 4);
    await archive(1);
    await expect(move(1, "sale", -1)).rejects.toThrow(/product is archived/);
    expect(await onHand(1)).toBe(4);

    await run("UPDATE products SET archived_at = NULL WHERE id = 1");
    await move(1, "sale", -1);
    expect(await onHand(1)).toBe(3);
  });

  it("can't be added to an order", async () => {
    await archive(2);
    await run("INSERT INTO purchase_orders (id, supplier_id, status, created_by) VALUES (1, 1, 'draft', 1)");
    await expect(
      run(
        "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 2, 5, 400)",
      ),
    ).rejects.toThrow(/product is archived/);
  });

  it("can't be archived while on an open order, draft or placed", async () => {
    await draftOrder();
    await expect(archive(1)).rejects.toThrow(/product is on an open purchase order/);
    await placeOrder();
    await expect(archive(1)).rejects.toThrow(/product is on an open purchase order/);

    await receiveOrder();
    await archive(1);
    expect(await scalar(client, "SELECT archived_at FROM products WHERE id = 1")).toBe(T0);
  });

  it("can be archived once its order is cancelled", async () => {
    await draftOrder();
    await run("UPDATE purchase_orders SET status = 'cancelled', cancelled_at = ? WHERE id = 1", [T0]);
    await archive(1);
    expect(await scalar(client, "SELECT archived_at FROM products WHERE id = 1")).toBe(T0);
  });
});

describe("activity log", () => {
  it("is append-only", async () => {
    await run(
      "INSERT INTO activity_log (user_id, action, entity_type, entity_id, summary) VALUES (1, 'product.created', 'product', 1, 'Added Widget')",
    );
    await expect(run("UPDATE activity_log SET summary = 'edited'")).rejects.toThrow(/append-only/);
    await expect(run("DELETE FROM activity_log")).rejects.toThrow(/append-only/);
  });
});
