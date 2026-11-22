/**
 * The live demo starts over every night at midnight in Dhaka: the Worker's Cron Trigger
 * (`triggers.crons` in wrangler.jsonc, wired up in worker.mjs) empties the tables and
 * writes the dataset again, ending at that midnight. The history always runs up to
 * yesterday, and whatever visitors changed during the day is cleared.
 *
 * It's one D1 batch, which D1 runs as one transaction and counts as one query against
 * the Free plan's 50 per invocation: if any statement fails, nothing changes and
 * yesterday's data stays.
 */

import { startOfDay } from "../lib/business-time.ts";
import { BLOCKING_TRIGGERS, demoReset } from "./demo.ts";

/**
 * The blocking triggers' definitions as the database holds them now, so the reset
 * recreates exactly what the migrations left, whichever migration last redefined each.
 */
async function liveTriggerDefinitions(db: D1Database) {
  const names = BLOCKING_TRIGGERS.map((name) => `'${name}'`).join(", ");
  const { results } = await db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN (${names})`)
    .all<{ name: string; sql: string }>();
  const byName = new Map(results.map((row) => [row.name, row.sql]));
  return BLOCKING_TRIGGERS.map((name) => {
    const sql = byName.get(name);
    if (!sql) throw new Error(`Trigger ${name} is missing from the database`);
    return sql;
  });
}

/** Rebuilds the demo dataset ending at the business-day midnight on or before `now`. */
export async function resetDemo(db: D1Database, now: Date) {
  const anchor = startOfDay(now);
  const statements = demoReset(await liveTriggerDefinitions(db), anchor);
  const started = Date.now();
  await db.batch(statements.map((sql) => db.prepare(sql)));
  return { anchor, statements: statements.length, ms: Date.now() - started };
}
