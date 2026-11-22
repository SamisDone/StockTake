// Writes .seed/demo.sql: a reset of every table followed by the demo dataset, the same
// statements the live Worker runs every night (src/seed/reset.ts).
// Run through `pnpm db:seed:local` or `pnpm db:seed:remote`.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { demoReset, today, triggerDefinitions } from "../src/seed/demo.ts";

// Every migration in order: the reset recreates each blocking trigger from its latest definition.
const migrations = readdirSync("drizzle")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`drizzle/${name}`, "utf8"))
  .join("\n");
const statements = demoReset(triggerDefinitions(migrations), today());

mkdirSync(".seed", { recursive: true });
writeFileSync(".seed/demo.sql", statements.join("\n") + "\n");
console.log(`Wrote ${statements.length} statements to .seed/demo.sql`);
