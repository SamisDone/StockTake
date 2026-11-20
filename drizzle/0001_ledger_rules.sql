-- Integrity rules the table constraints can't express. The database enforces them,
-- so no application bug can put stock or a purchase order into an impossible state.

-- Stock ledger ------------------------------------------------------------------

-- Every unit on hand has to come from a movement.
CREATE TRIGGER `products_on_hand_starts_at_zero`
BEFORE INSERT ON `products`
WHEN NEW.`on_hand` <> 0
BEGIN
  SELECT RAISE(ABORT, 'on_hand starts at zero; record stock as movements');
END;
--> statement-breakpoint

-- Apply each movement to the product. If the result would be negative, the CHECK on
-- products.on_hand fails and the movement insert is rolled back with it.
CREATE TRIGGER `stock_movements_apply`
AFTER INSERT ON `stock_movements`
BEGIN
  UPDATE `products` SET `on_hand` = `on_hand` + NEW.`quantity` WHERE `id` = NEW.`product_id`;
END;
--> statement-breakpoint

-- on_hand only ever changes to match the ledger total.
CREATE TRIGGER `products_on_hand_matches_ledger`
BEFORE UPDATE OF `on_hand` ON `products`
WHEN NEW.`on_hand` <> (
  SELECT coalesce(sum(`quantity`), 0) FROM `stock_movements` WHERE `product_id` = NEW.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'on_hand must match the stock ledger');
END;
--> statement-breakpoint

-- Movements are append-only; a correction is a new adjustment. user_id stays writable
-- so deleting a user can set it to NULL.
CREATE TRIGGER `stock_movements_no_update`
BEFORE UPDATE OF `product_id`, `kind`, `quantity`, `note`, `purchase_order_line_id`, `occurred_at`
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

-- A receipt must belong to a placed order and match its line exactly. The unique
-- index on purchase_order_line_id stops the same line being received twice.
CREATE TRIGGER `stock_movements_receipt_order_placed`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`kind` = 'receipt' AND NEW.`purchase_order_line_id` IS NOT NULL AND (
  SELECT o.`status`
  FROM `purchase_order_lines` l JOIN `purchase_orders` o ON o.`id` = l.`purchase_order_id`
  WHERE l.`id` = NEW.`purchase_order_line_id`
) <> 'ordered'
BEGIN
  SELECT RAISE(ABORT, 'only placed orders can be received');
END;
--> statement-breakpoint

CREATE TRIGGER `stock_movements_receipt_matches_line`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`kind` = 'receipt' AND NEW.`purchase_order_line_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `purchase_order_lines`
  WHERE `id` = NEW.`purchase_order_line_id`
    AND `product_id` = NEW.`product_id`
    AND `quantity` = NEW.`quantity`
)
BEGIN
  SELECT RAISE(ABORT, 'receipt must match its order line');
END;
--> statement-breakpoint

-- Purchase orders: draft → ordered → received, and draft | ordered → cancelled ----

CREATE TRIGGER `purchase_orders_start_as_draft`
BEFORE INSERT ON `purchase_orders`
WHEN NEW.`status` <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'new purchase orders start as drafts');
END;
--> statement-breakpoint

CREATE TRIGGER `purchase_orders_transition`
BEFORE UPDATE OF `status` ON `purchase_orders`
WHEN NEW.`status` <> OLD.`status` AND NOT (
  (OLD.`status` = 'draft' AND NEW.`status` IN ('ordered', 'cancelled')) OR
  (OLD.`status` = 'ordered' AND NEW.`status` IN ('received', 'cancelled'))
)
BEGIN
  SELECT RAISE(ABORT, 'purchase order cannot move from its current status to the requested one');
END;
--> statement-breakpoint

CREATE TRIGGER `purchase_orders_place_needs_lines`
BEFORE UPDATE OF `status` ON `purchase_orders`
WHEN OLD.`status` = 'draft' AND NEW.`status` = 'ordered' AND NOT EXISTS (
  SELECT 1 FROM `purchase_order_lines` WHERE `purchase_order_id` = NEW.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'an order needs at least one line before it is placed');
END;
--> statement-breakpoint

-- Receiving writes the receipts first, then flips the status, in one batch.
CREATE TRIGGER `purchase_orders_receive_needs_receipts`
BEFORE UPDATE OF `status` ON `purchase_orders`
WHEN OLD.`status` = 'ordered' AND NEW.`status` = 'received' AND EXISTS (
  SELECT 1 FROM `purchase_order_lines` l
  WHERE l.`purchase_order_id` = NEW.`id`
    AND NOT EXISTS (SELECT 1 FROM `stock_movements` m WHERE m.`purchase_order_line_id` = l.`id`)
)
BEGIN
  SELECT RAISE(ABORT, 'every line needs a receipt before the order is received');
END;
--> statement-breakpoint

-- Lines are editable only while their order is a draft.
CREATE TRIGGER `purchase_order_lines_locked_insert`
BEFORE INSERT ON `purchase_order_lines`
WHEN (SELECT `status` FROM `purchase_orders` WHERE `id` = NEW.`purchase_order_id`) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'lines can only change while the order is a draft');
END;
--> statement-breakpoint

CREATE TRIGGER `purchase_order_lines_locked_update`
BEFORE UPDATE ON `purchase_order_lines`
WHEN (SELECT `status` FROM `purchase_orders` WHERE `id` = OLD.`purchase_order_id`) <> 'draft'
  OR (SELECT `status` FROM `purchase_orders` WHERE `id` = NEW.`purchase_order_id`) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'lines can only change while the order is a draft');
END;
--> statement-breakpoint

CREATE TRIGGER `purchase_order_lines_locked_delete`
BEFORE DELETE ON `purchase_order_lines`
WHEN (SELECT `status` FROM `purchase_orders` WHERE `id` = OLD.`purchase_order_id`) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'lines can only change while the order is a draft');
END;
--> statement-breakpoint

-- Activity log ------------------------------------------------------------------

CREATE TRIGGER `activity_log_no_update`
BEFORE UPDATE OF `action`, `entity_type`, `entity_id`, `summary`, `occurred_at` ON `activity_log`
BEGIN
  SELECT RAISE(ABORT, 'the activity log is append-only');
END;
--> statement-breakpoint

CREATE TRIGGER `activity_log_no_delete`
BEFORE DELETE ON `activity_log`
BEGIN
  SELECT RAISE(ABORT, 'the activity log is append-only');
END;
