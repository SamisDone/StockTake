import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * D1's free plan reads 5 million rows a day, for the whole account. Dropping a table
 * with foreign keys on makes SQLite look up, for every row it drops, the rows that
 * still point at it. drizzle-kit rebuilds a table as: create `__new_x`, copy the rows,
 * drop `x`, rename, then create the indexes; so a self-reference like
 * `stock_movements.reverses_id` is looked up with no index, once per row, and the drop
 * reads rows². Migration 0008 did that to ~6,300 movements on 2026-11-23 and read
 * about 10 million rows: the day's allowance, so the live demo stopped until midnight
 * UTC. A rebuild must index those columns on `__new_x` before it drops `x`.
 */

/** Applied before this rule existed; they can't change now. */
const APPLIED_BEFORE_THE_RULE = new Set(["0008_partial_receiving.sql"]);

const statements = (sql: string) => sql.split("--> statement-breakpoint").map((s) => s.trim());

/** For each `__new_x` table a migration creates, the columns that reference `x` itself. */
function selfReferences(sql: string) {
  const found = new Map<string, string[]>();
  for (const statement of statements(sql)) {
    const table = statement.match(/^CREATE TABLE `__new_(\w+)`/)?.[1];
    if (!table) continue;
    const columns = [
      ...statement.matchAll(new RegExp(`FOREIGN KEY \\(\`(\\w+)\`\\) REFERENCES \`${table}\``, "g")),
    ].map((m) => m[1]);
    found.set(table, columns);
  }
  return found;
}

/** The problems in one migration: a dropped table whose rebuilt twin points at it unindexed. */
export function unindexedDrops(sql: string) {
  const problems: string[] = [];
  const references = selfReferences(sql);
  const indexed = new Set<string>();
  for (const statement of statements(sql)) {
    const index = statement.match(/^CREATE (?:UNIQUE )?INDEX `\w+` ON `__new_(\w+)` \(`(\w+)`/);
    if (index) indexed.add(`${index[1]}.${index[2]}`);
    const dropped = statement.match(/^DROP TABLE `(\w+)`/)?.[1];
    if (!dropped) continue;
    for (const column of references.get(dropped) ?? []) {
      if (!indexed.has(`${dropped}.${column}`)) problems.push(`${dropped}.${column}`);
    }
  }
  return problems;
}

describe("migrations", () => {
  it("index a rebuilt table's references to itself before dropping the old table", () => {
    for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql"))) {
      if (APPLIED_BEFORE_THE_RULE.has(file)) continue;
      expect(unindexedDrops(readFileSync(`drizzle/${file}`, "utf8")), file).toEqual([]);
    }
  });

  it("catch the rebuild that read the day's allowance", () => {
    expect(unindexedDrops(readFileSync("drizzle/0008_partial_receiving.sql", "utf8"))).toEqual([
      "stock_movements.reverses_id",
    ]);
    const fixed = readFileSync("drizzle/0008_partial_receiving.sql", "utf8").replace(
      "DROP TABLE `stock_movements`;",
      "CREATE UNIQUE INDEX `__new_reverses` ON `__new_stock_movements` (`reverses_id`);--> statement-breakpoint\nDROP TABLE `stock_movements`;",
    );
    expect(unindexedDrops(fixed)).toEqual([]);
  });
});
