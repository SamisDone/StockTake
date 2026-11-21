ALTER TABLE `activity_log` ADD `facts` text;
--> statement-breakpoint
-- The facts are part of the record: append-only like the rest of the entry.
DROP TRIGGER `activity_log_no_update`;
--> statement-breakpoint
CREATE TRIGGER `activity_log_no_update`
BEFORE UPDATE OF `action`, `entity_type`, `entity_id`, `summary`, `facts`, `occurred_at` ON `activity_log`
BEGIN
  SELECT RAISE(ABORT, 'the activity log is append-only');
END;
