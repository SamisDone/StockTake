CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`summary` text NOT NULL,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_log_occurred` ON `activity_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_log_entity` ON `activity_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`supplier_id` integer,
	`unit_cost_cents` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`reorder_point` integer DEFAULT 0 NOT NULL,
	`reorder_quantity` integer DEFAULT 0 NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_sku_uppercase" CHECK("products"."sku" = upper("products"."sku")),
	CONSTRAINT "products_on_hand_nonnegative" CHECK("products"."on_hand" >= 0),
	CONSTRAINT "products_money_nonnegative" CHECK("products"."unit_cost_cents" >= 0 AND "products"."unit_price_cents" >= 0),
	CONSTRAINT "products_reorder_nonnegative" CHECK("products"."reorder_point" >= 0 AND "products"."reorder_quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_supplier_id` ON `products` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` integer PRIMARY KEY NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_order_lines_quantity_positive" CHECK("purchase_order_lines"."quantity" > 0),
	CONSTRAINT "purchase_order_lines_cost_nonnegative" CHECK("purchase_order_lines"."unit_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_order_lines_one_per_product` ON `purchase_order_lines` (`purchase_order_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_lines_product_id` ON `purchase_order_lines` (`product_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY NOT NULL,
	`supplier_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`expected_at` integer,
	`ordered_at` integer,
	`received_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_orders_status" CHECK("purchase_orders"."status" IN ('draft', 'ordered', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_status_timestamps" CHECK(CASE "purchase_orders"."status"
        WHEN 'draft' THEN "purchase_orders"."ordered_at" IS NULL AND "purchase_orders"."received_at" IS NULL AND "purchase_orders"."cancelled_at" IS NULL
        WHEN 'ordered' THEN "purchase_orders"."ordered_at" IS NOT NULL AND "purchase_orders"."received_at" IS NULL AND "purchase_orders"."cancelled_at" IS NULL
        WHEN 'received' THEN "purchase_orders"."ordered_at" IS NOT NULL AND "purchase_orders"."received_at" IS NOT NULL AND "purchase_orders"."cancelled_at" IS NULL
        WHEN 'cancelled' THEN "purchase_orders"."cancelled_at" IS NOT NULL AND "purchase_orders"."received_at" IS NULL
      END)
);
--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_id` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY NOT NULL,
	`product_id` integer NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`note` text,
	`purchase_order_line_id` integer,
	`user_id` integer,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stock_movements_kind" CHECK("stock_movements"."kind" IN ('receipt', 'sale', 'adjustment', 'return', 'write_off')),
	CONSTRAINT "stock_movements_quantity_sign" CHECK(CASE "stock_movements"."kind"
        WHEN 'receipt' THEN "stock_movements"."quantity" > 0
        WHEN 'return' THEN "stock_movements"."quantity" > 0
        WHEN 'sale' THEN "stock_movements"."quantity" < 0
        WHEN 'write_off' THEN "stock_movements"."quantity" < 0
        WHEN 'adjustment' THEN "stock_movements"."quantity" <> 0
      END),
	CONSTRAINT "stock_movements_receipt_line" CHECK(("stock_movements"."kind" = 'receipt') = ("stock_movements"."purchase_order_line_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_purchase_order_line_id_unique` ON `stock_movements` (`purchase_order_line_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_occurred` ON `stock_movements` (`product_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `supplier_reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`supplier_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "supplier_reviews_rating_range" CHECK("supplier_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_reviews_one_per_user` ON `supplier_reviews` (`supplier_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`lead_time_days` integer DEFAULT 7 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK("users"."email" = lower("users"."email")),
	CONSTRAINT "users_role" CHECK("users"."role" IN ('admin', 'staff'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);