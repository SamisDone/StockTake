/**
 * Writes the database refuses, shown on the landing page. Every message here is the
 * database's own answer to that exact SQL, checked by refusals.test.ts against the real
 * migrations: if a rule changes, the test fails before the page can claim something false.
 */
export type Refusal = {
  /** What someone might try, in plain words. */
  attempt: string;
  /** The write, as it would reach the database. */
  sql: string;
  /** The database's reply, verbatim. */
  refusal: string;
};

export const REFUSALS: Refusal[] = [
  {
    attempt: "Type a new count over the old one",
    sql: "UPDATE products SET on_hand = 500 WHERE sku = 'WID-001';",
    refusal: "on_hand must match the stock ledger",
  },
  {
    attempt: "Quietly edit a sale after the fact",
    sql: "UPDATE stock_movements SET quantity = -1 WHERE id = 2;",
    refusal: "stock movements are append-only",
  },
  {
    attempt: "Sell stock that isn't on the shelf",
    sql: "INSERT INTO stock_movements (product_id, kind, quantity) VALUES (1, 'sale', -500);",
    refusal: "CHECK constraint failed: products_on_hand_nonnegative",
  },
  {
    attempt: "Receive the same delivery twice",
    sql: "INSERT INTO stock_movements (product_id, kind, quantity, purchase_order_line_id) VALUES (1, 'receipt', 50, 1);",
    refusal: "only placed orders can be received",
  },
  {
    attempt: "Add to an order after it was placed",
    sql: "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 2, 10, 400);",
    refusal: "lines can only change while the order is a draft",
  },
  {
    attempt: "Wipe the activity log",
    sql: "DELETE FROM activity_log;",
    refusal: "the activity log is append-only",
  },
];
