// Writes .seed/demo.sql: a reset of every table followed by the demo dataset.
// Run through `pnpm db:seed:local` or `pnpm db:seed:remote`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { demoPasswordHash, demoStatements, resetStatements, todayUtc } from "../src/seed/demo.ts";

const rules = readFileSync("drizzle/0001_ledger_rules.sql", "utf8");
const statements = [
  ...resetStatements(rules),
  ...demoStatements({ anchor: todayUtc(), passwordHash: await demoPasswordHash() }),
];

mkdirSync(".seed", { recursive: true });
writeFileSync(".seed/demo.sql", statements.join("\n") + "\n");
console.log(`Wrote ${statements.length} statements to .seed/demo.sql`);
