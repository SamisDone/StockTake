CREATE TABLE `exchange_rates` (
	`currency` text PRIMARY KEY NOT NULL,
	`per_usd` real NOT NULL,
	`as_of` text NOT NULL,
	`fetched_at` integer NOT NULL,
	CONSTRAINT "exchange_rates_positive" CHECK("exchange_rates"."per_usd" > 0)
);
--> statement-breakpoint
-- A starting rate (the source's figure for 2026-11-20). fetched_at 0 marks it stale, so the first request refreshes it.
INSERT INTO `exchange_rates` (`currency`, `per_usd`, `as_of`, `fetched_at`) VALUES ('BDT', 124.6563, '2026-11-20', 0);
