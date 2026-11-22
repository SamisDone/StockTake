CREATE TABLE `assistant_budget` (
	`day` text PRIMARY KEY NOT NULL,
	`neurons` real DEFAULT 0 NOT NULL,
	CONSTRAINT "assistant_budget_neurons" CHECK("assistant_budget"."neurons" >= 0)
);
--> statement-breakpoint
-- Usage rows so far were keyed by UTC day, so their neurons carry over as the budget spent.
INSERT INTO `assistant_budget` (`day`, `neurons`) SELECT `day`, sum(`neurons`) FROM `assistant_usage` GROUP BY `day`;
