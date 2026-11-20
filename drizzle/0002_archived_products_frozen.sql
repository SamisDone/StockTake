-- An archived product is frozen: its ledger stays as it was, nothing new can be booked
-- against it, and nothing can be ordered. Restoring it lifts all three.

-- No movements for an archived product.
CREATE TRIGGER `stock_movements_product_active`
BEFORE INSERT ON `stock_movements`
WHEN (SELECT `archived_at` FROM `products` WHERE `id` = NEW.`product_id`) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'product is archived');
END;
--> statement-breakpoint

-- No order lines for an archived product.
CREATE TRIGGER `purchase_order_lines_product_active`
BEFORE INSERT ON `purchase_order_lines`
WHEN (SELECT `archived_at` FROM `products` WHERE `id` = NEW.`product_id`) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'product is archived');
END;
--> statement-breakpoint

-- A product on an open order (a draft, or placed and not yet received) can't be
-- archived, so an order can never be received into a frozen product.
CREATE TRIGGER `products_archive_no_open_orders`
BEFORE UPDATE OF `archived_at` ON `products`
WHEN OLD.`archived_at` IS NULL AND NEW.`archived_at` IS NOT NULL AND EXISTS (
  SELECT 1
  FROM `purchase_order_lines` l JOIN `purchase_orders` o ON o.`id` = l.`purchase_order_id`
  WHERE l.`product_id` = NEW.`id` AND o.`status` IN ('draft', 'ordered')
)
BEGIN
  SELECT RAISE(ABORT, 'product is on an open purchase order');
END;
