-- Sales with prices: the rules the database keeps, whatever the application does.

-- A sale is a record: only its voiding is ever written to it afterwards, once.
CREATE TRIGGER `sales_no_update`
BEFORE UPDATE OF `customer_id`, `discount_cents`, `note`, `sold_at`, `created_by` ON `sales`
BEGIN
  SELECT RAISE(ABORT, 'sales are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `sales_void_once`
BEFORE UPDATE OF `voided_at`, `voided_by` ON `sales`
WHEN OLD.`voided_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'sale is voided already');
END;
--> statement-breakpoint
CREATE TRIGGER `sales_no_delete`
BEFORE DELETE ON `sales`
BEGIN
  SELECT RAISE(ABORT, 'sales are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `sale_lines_no_update`
BEFORE UPDATE ON `sale_lines`
BEGIN
  SELECT RAISE(ABORT, 'sale lines are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `sale_lines_no_delete`
BEFORE DELETE ON `sale_lines`
BEGIN
  SELECT RAISE(ABORT, 'sale lines are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `sale_lines_sale_open`
BEFORE INSERT ON `sale_lines`
WHEN (SELECT `voided_at` FROM `sales` WHERE `id` = NEW.`sale_id`) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'sale is voided');
END;
--> statement-breakpoint

-- The stock a sale takes: one sale movement per line, for the line's product and its
-- quantity exactly, while the sale stands.
CREATE TRIGGER `stock_movements_sale_line_matches`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`sale_line_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `sale_lines` l JOIN `sales` s ON s.`id` = l.`sale_id`
  WHERE l.`id` = NEW.`sale_line_id`
    AND l.`product_id` = NEW.`product_id`
    AND l.`quantity` = -NEW.`quantity`
    AND NEW.`kind` = 'sale'
    AND s.`voided_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'a sale movement must match its sale line');
END;
--> statement-breakpoint
-- A priced sale's stock comes back only by voiding the sale, never by a quick undo.
CREATE TRIGGER `stock_movements_sale_reversal_voided`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`reverses_id` IS NOT NULL AND EXISTS (
  SELECT 1 FROM `stock_movements` o
  JOIN `sale_lines` l ON l.`id` = o.`sale_line_id`
  JOIN `sales` s ON s.`id` = l.`sale_id`
  WHERE o.`id` = NEW.`reverses_id` AND s.`voided_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'a sale''s stock comes back only when the sale is voided');
END;
--> statement-breakpoint
-- The sale line a movement belongs to is part of the record, like the rest of the row.
DROP TRIGGER `stock_movements_no_update`;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_no_update`
BEFORE UPDATE OF `product_id`, `kind`, `quantity`, `note`, `purchase_order_line_id`, `occurred_at`, `reverses_id`, `sale_line_id`
ON `stock_movements`
BEGIN
  SELECT RAISE(ABORT, 'stock movements are append-only');
END;
--> statement-breakpoint

-- Money received is a record too, and never more than what's owed.
CREATE TRIGGER `payments_no_update`
BEFORE UPDATE ON `payments`
BEGIN
  SELECT RAISE(ABORT, 'payments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `payments_no_delete`
BEFORE DELETE ON `payments`
BEGIN
  SELECT RAISE(ABORT, 'payments are append-only');
END;
--> statement-breakpoint
-- A payment at a sale is from that sale's customer (or nobody, for a walk-in), and a
-- voided sale takes no money.
CREATE TRIGGER `payments_sale_matches`
BEFORE INSERT ON `payments`
WHEN NEW.`sale_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `sales` s
  WHERE s.`id` = NEW.`sale_id` AND s.`customer_id` IS NEW.`customer_id` AND s.`voided_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'a payment must match its sale');
END;
--> statement-breakpoint
-- A customer never pays more than they owe across their standing sales.
CREATE TRIGGER `payments_within_customer_due`
BEFORE INSERT ON `payments`
WHEN NEW.`customer_id` IS NOT NULL AND (
  coalesce((
    SELECT sum(l.`net_cents`) FROM `sale_lines` l JOIN `sales` s ON s.`id` = l.`sale_id`
    WHERE s.`customer_id` = NEW.`customer_id` AND s.`voided_at` IS NULL
  ), 0)
  - coalesce((SELECT sum(`amount_cents`) FROM `payments` WHERE `customer_id` = NEW.`customer_id`), 0)
  - NEW.`amount_cents`
) < 0
BEGIN
  SELECT RAISE(ABORT, 'a payment can''t be more than the customer owes');
END;
--> statement-breakpoint
-- A walk-in pays for one sale, never more than its total.
CREATE TRIGGER `payments_within_sale_total`
BEFORE INSERT ON `payments`
WHEN NEW.`customer_id` IS NULL AND (
  coalesce((SELECT sum(`net_cents`) FROM `sale_lines` WHERE `sale_id` = NEW.`sale_id`), 0)
  - coalesce((SELECT sum(`amount_cents`) FROM `payments` WHERE `sale_id` = NEW.`sale_id`), 0)
  - NEW.`amount_cents`
) < 0
BEGIN
  SELECT RAISE(ABORT, 'a payment can''t be more than the sale''s total');
END;
