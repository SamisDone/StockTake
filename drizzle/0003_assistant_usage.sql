CREATE TABLE `assistant_usage` (
	`user_id` integer NOT NULL,
	`day` text NOT NULL,
	`questions` integer DEFAULT 0 NOT NULL,
	`neurons` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assistant_usage_questions" CHECK("assistant_usage"."questions" >= 0),
	CONSTRAINT "assistant_usage_neurons" CHECK("assistant_usage"."neurons" >= 0)
);
--> statement-breakpoint
CREATE INDEX `assistant_usage_day` ON `assistant_usage` (`day`);