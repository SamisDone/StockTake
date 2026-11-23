/**
 * Writes the database refuses, shown on the landing page. Every message here is the
 * database's own answer to that exact SQL (machine text, so it stays as the database
 * says it in either language), checked by refusals.test.ts against the real
 * migrations: if a rule changes, the test fails before the page can claim something false.
 */
import type { Copy } from "./i18n";

export type Refusal = {
  /** What someone might try, in plain words, in each language. */
  attempt: Copy<string>;
  /** The write, as it would reach the database. */
  sql: string;
  /** The database's reply, verbatim. */
  refusal: string;
};

/**
 * The first refusal's UPDATE, split around the number it tries to write, so the landing
 * page can let a visitor type their own. The trigger refuses any number other than the
 * ledger's total (`onHand`, WID-001's on hand in the state the test builds: 50 received,
 * 5 sold); the test runs several numbers, and the total itself, to prove it.
 */
export const ON_HAND_STATEMENT = {
  before: "UPDATE products SET on_hand = ",
  value: "500",
  after: " WHERE sku = 'WID-001';",
  onHand: 45,
};

/** The on-hand UPDATE writing `value`. */
export const onHandStatement = (value: string) => `${ON_HAND_STATEMENT.before}${value}${ON_HAND_STATEMENT.after}`;

export const REFUSALS: Refusal[] = [
  {
    attempt: { en: "Type a new count over the old one", bn: "পুরোনো গণনার ওপর নতুন সংখ্যা বসানো" },
    sql: onHandStatement(ON_HAND_STATEMENT.value),
    refusal: "on_hand must match the stock ledger",
  },
  {
    attempt: { en: "Quietly edit a sale after the fact", bn: "পরে চুপচাপ একটি বিক্রি বদলে দেওয়া" },
    sql: "UPDATE stock_movements SET quantity = -1 WHERE id = 2;",
    refusal: "stock movements are append-only",
  },
  {
    attempt: { en: "Sell stock that isn't on the shelf", bn: "তাকে নেই এমন মাল বিক্রি করা" },
    sql: "INSERT INTO stock_movements (product_id, kind, quantity) VALUES (1, 'sale', -500);",
    refusal: "CHECK constraint failed: products_on_hand_nonnegative",
  },
  {
    attempt: { en: "Receive the same delivery twice", bn: "একই ডেলিভারি দুবার বুঝে নেওয়া" },
    sql: "INSERT INTO stock_movements (product_id, kind, quantity, purchase_order_line_id) VALUES (1, 'receipt', 50, 1);",
    refusal: "only placed orders can be received",
  },
  {
    attempt: { en: "Add to an order after it was placed", bn: "অর্ডার দেওয়ার পর তাতে কিছু যোগ করা" },
    sql: "INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (1, 2, 10, 400);",
    refusal: "lines can only change while the order is a draft",
  },
  {
    attempt: { en: "Wipe the activity log", bn: "কার্যক্রমের খাতা মুছে ফেলা" },
    sql: "DELETE FROM activity_log;",
    refusal: "the activity log is append-only",
  },
];
