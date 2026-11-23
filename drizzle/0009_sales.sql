CREATE TABLE `customers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY NOT NULL,
	`customer_id` integer,
	`sale_id` integer,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`note` text,
	`received_at` integer NOT NULL,
	`user_id` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payments_amount_positive" CHECK("payments"."amount_cents" > 0),
	CONSTRAINT "payments_method" CHECK("payments"."method" IN ('cash', 'mobile', 'card', 'bank')),
	CONSTRAINT "payments_belong" CHECK("payments"."customer_id" IS NOT NULL OR "payments"."sale_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `payments_customer_id` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_sale_id` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sale_lines` (
	`id` integer PRIMARY KEY NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`net_cents` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_lines_quantity_positive" CHECK("sale_lines"."quantity" > 0),
	CONSTRAINT "sale_lines_price_nonnegative" CHECK("sale_lines"."unit_price_cents" >= 0),
	CONSTRAINT "sale_lines_discount_within_line" CHECK("sale_lines"."discount_cents" >= 0 AND "sale_lines"."discount_cents" <= "sale_lines"."quantity" * "sale_lines"."unit_price_cents"),
	CONSTRAINT "sale_lines_net_within_line" CHECK("sale_lines"."net_cents" >= 0 AND "sale_lines"."net_cents" <= "sale_lines"."quantity" * "sale_lines"."unit_price_cents" - "sale_lines"."discount_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_lines_one_per_product` ON `sale_lines` (`sale_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `sale_lines_product_id` ON `sale_lines` (`product_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY NOT NULL,
	`customer_id` integer,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`note` text,
	`sold_at` integer NOT NULL,
	`created_by` integer NOT NULL,
	`voided_at` integer,
	`voided_by` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_discount_nonnegative" CHECK("sales"."discount_cents" >= 0),
	CONSTRAINT "sales_voided_together" CHECK(("sales"."voided_at" IS NULL) = ("sales"."voided_by" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `sales_customer_id` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_sold_at` ON `sales` (`sold_at`);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `sale_line_id` integer REFERENCES sale_lines(id);--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_sale_line_id_unique` ON `stock_movements` (`sale_line_id`);