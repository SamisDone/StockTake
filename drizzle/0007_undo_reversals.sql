ALTER TABLE `stock_movements` ADD `reverses_id` integer REFERENCES stock_movements(id);--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_reverses_id_unique` ON `stock_movements` (`reverses_id`);--> statement-breakpoint
-- An undo reverses one movement exactly: the same product, the opposite quantity,
-- recorded as an adjustment. Receipts belong to their order and are never undone
-- here, and an undo can't itself be undone (the unique index above stops a second
-- undo of the same movement).
CREATE TRIGGER `stock_movements_reversal_matches`
BEFORE INSERT ON `stock_movements`
WHEN NEW.`reverses_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `stock_movements` o
  WHERE o.`id` = NEW.`reverses_id`
    AND o.`product_id` = NEW.`product_id`
    AND o.`quantity` = -NEW.`quantity`
    AND o.`kind` <> 'receipt'
    AND o.`reverses_id` IS NULL
    AND NEW.`kind` = 'adjustment'
)
BEGIN
  SELECT RAISE(ABORT, 'an undo must reverse one movement exactly');
END;
--> statement-breakpoint
-- What an undo reverses is part of the record: append-only like the rest of the row.
DROP TRIGGER `stock_movements_no_update`;
--> statement-breakpoint
CREATE TRIGGER `stock_movements_no_update`
BEFORE UPDATE OF `product_id`, `kind`, `quantity`, `note`, `purchase_order_line_id`, `occurred_at`, `reverses_id`
ON `stock_movements`
BEGIN
  SELECT RAISE(ABORT, 'stock movements are append-only');
END;
