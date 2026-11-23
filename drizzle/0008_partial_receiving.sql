-- Partial receiving and returns to the supplier.
--
-- A line can now be received in several parts, never past what was ordered, and stock
-- can go back to the supplier against the line it came in on, never more than the line
-- received. SQLite can't change a CHECK in place, so stock_movements is rebuilt: a new
-- kind, `supplier_return`, which like a receipt carries its order line, and the line no
-- longer unique. Every rule that touched the old table is dropped first (a trigger on
-- another table that names a dropped table stops the rename) and written again after.
-- Foreign keys are checked at commit (defer_foreign_keys), since D1 and the test
-- database both run a migration inside one transaction.

PRAGMA defer_foreign_keys = on;--> statement-breakpoint
DROP TRIGGER `products_on_hand_matches_ledger`;--> statement-breakpoint
DROP TRIGGER `purchase_orders_receive_needs_receipts`;--> statement-breakpoint
CREATE TABLE `__new_stock_movements` (
	`id` integer PRIMARY KEY NOT NULL,
	`product_id` integer NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`note` text,
	`purchase_order_line_id` integer,
	`user_id` integer,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`reverses_id` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reverses_id`) REFERENCES `stock_movements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movements_kind" CHECK("__new_stock_movements"."kind" IN ('receipt', 'sale', 'adjustment', 'return', 'write_off', 'supplier_return')),
	CONSTRAINT "stock_movements_quantity_sign" CHECK(CASE "__new_stock_movements"."kind"
        WHEN 'receipt' THEN "__new_stock_movements"."quantity" > 0
        WHEN 'return' THEN "__new_stock_movements"."quantity" > 0
        WHEN 'sale' THEN "__new_stock_movements"."quantity" < 0
        WHEN 'write_off' THEN "__new_stock_movements"."quantity" < 0
        WHEN 'supplier_return' THEN "__new_stock_movements"."quantity" < 0
        WHEN 'adjustment' THEN "__new_stock_movements"."quantity" <> 0
      END),
	CONSTRAINT "stock_movements_receipt_line" CHECK(("__new_stock_movements"."kind" IN ('receipt', 'supplier_return')) = ("__new_stock_movements"."purchase_order_line_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_stock_movements`("id", "product_id", "kind", "quantity", "note", "purchase_order_line_id", "user_id", "occurred_at", "reverses_id") SELECT "id", "product_id", "kind", "quantity", "note", "purchase_order_line_id", "user_id", "occurred_at", "reverses_id" FROM `stock_movements`;--> statement-breakpoint
DROP TABLE `stock_movements`;--> statement-breakpoint
ALTER TABLE `__new_stock_movements` RENAME TO `stock_movements`;--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_reverses_id_unique` ON `stock_movements` (`reverses_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_occurred` ON `stock_movements` (`product_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_purchase_order_line` ON `stock_movements` (`purchase_order_line_id`);--> statement-breakpoint

-- The ledger's own rules, as before ----------------------------------------------

CREATE TRIGGER `products_on_hand_matches_ledger`
BEFORE UPDATE OF `on_hand` ON `products`
WHEN NEW.`on_hand` <> (
  SELECT coalesce(sum(`quantity`), 0) FROM `stock_movements` WHERE `product_id` = NEW.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'on_hand must match the stock ledger');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_apply`
AFTER INSERT ON `stock_movements`
BEGIN
  UPDATE `products` SET `on_hand` = `on_hand` + NEW.`quantity` WHERE `id` = NEW.`product_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_no_update`
BEFORE UPDATE OF `product_id`, `kind`, `quantity`, `note`, `purchase_order_line_id`, `occurred_at`, `reverses_id`
ON `stock_movements`
BEGIN
  SELECT RAISE(ABORT, 'stock movements are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_no_delete`
BEFORE DELETE ON `stock_movements`
BEGIN
  SELECT RAISE(ABORT, 'stock movements are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_product_active`
BEFORE INSERT ON `stock_movements`
WHEN (SELECT `archived_at` FROM `products` WHERE `id` = NEW.`product_id`) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'product is archived');
END;
--> statement-breakpoint
-- An undo reverses one movement exactly. Receipts and returns to the supplier belong to
-- their order and are never undone here.
CREATE TRIGGER `stock_movements_reversal_matches`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`reverses_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `stock_movements` o
  WHERE o.`id` = NEW.`reverses_id`
    AND o.`product_id` = NEW.`product_id`
    AND o.`quantity` = -NEW.`quantity`
    AND o.`kind` NOT IN ('receipt', 'supplier_return')
    AND o.`reverses_id` IS NULL
    AND NEW.`kind` = 'adjustment'
)
BEGIN
  SELECT RAISE(ABORT, 'an undo must reverse one movement exactly');
END;
--> statement-breakpoint

-- Receiving, in parts -------------------------------------------------------------

-- A receipt belongs to a placed order.
CREATE TRIGGER `stock_movements_receipt_order_placed`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`kind` = 'receipt' AND NEW.`purchase_order_line_id` IS NOT NULL AND (
  SELECT o.`status`
  FROM `purchase_order_lines` l JOIN `purchase_orders` o ON o.`id` = l.`purchase_order_id`
  WHERE l.`id` = NEW.`purchase_order_line_id`
) IS NOT 'ordered'
BEGIN
  SELECT RAISE(ABORT, 'only placed orders can be received');
END;
--> statement-breakpoint
-- A receipt is for its line's product, and the line's receipts never add up to more than
-- it ordered. Receiving the same delivery twice runs past the line and fails as a whole.
CREATE TRIGGER `stock_movements_receipt_within_line`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`kind` = 'receipt' AND NEW.`purchase_order_line_id` IS NOT NULL AND (
  -- An order that isn't placed is refused by the trigger above, in its own words.
  SELECT o.`status`
  FROM `purchase_order_lines` l JOIN `purchase_orders` o ON o.`id` = l.`purchase_order_id`
  WHERE l.`id` = NEW.`purchase_order_line_id`
) = 'ordered' AND NOT EXISTS (
  SELECT 1 FROM `purchase_order_lines` l
  WHERE l.`id` = NEW.`purchase_order_line_id`
    AND l.`product_id` = NEW.`product_id`
    AND NEW.`quantity` + coalesce((
      SELECT sum(m.`quantity`) FROM `stock_movements` m
      WHERE m.`purchase_order_line_id` = l.`id` AND m.`kind` = 'receipt'
    ), 0) <= l.`quantity`
)
BEGIN
  SELECT RAISE(ABORT, 'a line can''t receive more than it ordered');
END;
--> statement-breakpoint
-- An order is received once something has come in: in full, or closed short when the
-- rest isn't coming. Nothing in at all is a cancellation, not a receipt.
CREATE TRIGGER `purchase_orders_receive_needs_receipts`
BEFORE UPDATE OF `status` ON `purchase_orders`
WHEN OLD.`status` = 'ordered' AND NEW.`status` = 'received' AND NOT EXISTS (
  SELECT 1 FROM `stock_movements` m JOIN `purchase_order_lines` l ON l.`id` = m.`purchase_order_line_id`
  WHERE l.`purchase_order_id` = NEW.`id` AND m.`kind` = 'receipt'
)
BEGIN
  SELECT RAISE(ABORT, 'an order needs something received before it is closed as received');
END;
--> statement-breakpoint

-- Once anything has come in, the order can't be cancelled: the stock it brought is in
-- the ledger. It's closed short instead.
CREATE TRIGGER `purchase_orders_cancel_nothing_received`
BEFORE UPDATE OF `status` ON `purchase_orders`
WHEN OLD.`status` = 'ordered' AND NEW.`status` = 'cancelled' AND EXISTS (
  SELECT 1 FROM `stock_movements` m JOIN `purchase_order_lines` l ON l.`id` = m.`purchase_order_line_id`
  WHERE l.`purchase_order_id` = NEW.`id` AND m.`kind` = 'receipt'
)
BEGIN
  SELECT RAISE(ABORT, 'part of this order has come in, so it can''t be cancelled');
END;
--> statement-breakpoint

-- Returns to the supplier ---------------------------------------------------------

-- Stock goes back against the line it came in on: the same product, from an order that
-- was placed or received, and never more than the line has received less what it has
-- already sent back.
CREATE TRIGGER `stock_movements_supplier_return_within_line`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`kind` = 'supplier_return' AND NEW.`purchase_order_line_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `purchase_order_lines` l JOIN `purchase_orders` o ON o.`id` = l.`purchase_order_id`
  WHERE l.`id` = NEW.`purchase_order_line_id`
    AND l.`product_id` = NEW.`product_id`
    AND o.`status` IN ('ordered', 'received')
    AND -NEW.`quantity` <= coalesce((
      SELECT sum(m.`quantity`) FROM `stock_movements` m
      WHERE m.`purchase_order_line_id` = l.`id` AND m.`kind` IN ('receipt', 'supplier_return')
    ), 0)
)
BEGIN
  SELECT RAISE(ABORT, 'a line can''t send back more than it received');
END;
