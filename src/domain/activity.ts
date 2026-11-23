import { and, asc, desc, eq, gte, lt, or, type SQL, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { activityLog, users } from "@/db/schema";
import type { Actor } from "./actor";
import { type ActivityEvent, describeActivity } from "./activity-copy";

export type ActivityEntry = ActivityEvent & {
  entityType: "product" | "supplier" | "purchase_order" | "user" | "sale" | "customer";
  /** A number, or SQL that resolves to the new row's ID inside a batch. */
  entityId: number | SQL<number>;
};

/**
 * The insert for one activity entry, to go in the same batch as the change it describes.
 * Its summary is the English sentence; its facts let the feed print it in any language.
 */
export function logActivity(db: Database, actor: Actor, entry: ActivityEntry, now: Date) {
  return db.insert(activityLog).values({
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: describeActivity("en", entry),
    facts: entry.facts,
    userId: actor.id,
    occurredAt: now,
  });
}

/** Which entries a feed shows: action prefixes ("stock."), one person, and a window [from, to). */
export type ActivityFilter = {
  entityType?: ActivityEntry["entityType"];
  entityId?: number;
  /** Action prefixes, matched literally: "stock." matches "stock.sale". */
  actions?: string[];
  userId?: number;
  from?: Date;
  to?: Date;
};

/** Literal prefix match, escaped with `!` (see `containsPattern`). */
const startsWith = (prefix: string) =>
  sql`${activityLog.action} LIKE ${`${prefix.replace(/[!%_]/g, "!$&")}%`} ESCAPE '!'`;

function matching({ entityType, entityId, actions, userId, from, to }: ActivityFilter) {
  return and(
    entityType ? eq(activityLog.entityType, entityType) : undefined,
    entityId !== undefined ? eq(activityLog.entityId, entityId) : undefined,
    actions && actions.length > 0 ? or(...actions.map(startsWith)) : undefined,
    userId !== undefined ? eq(activityLog.userId, userId) : undefined,
    from ? gte(activityLog.occurredAt, from) : undefined,
    to ? lt(activityLog.occurredAt, to) : undefined,
  );
}

/** The activity feed, newest first, filtered. */
export async function listActivity(db: Database, { limit = 50, ...filter }: ActivityFilter & { limit?: number } = {}) {
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      summary: activityLog.summary,
      facts: activityLog.facts,
      occurredAt: activityLog.occurredAt,
      userId: activityLog.userId,
      userName: users.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId))
    .where(matching(filter))
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .limit(limit);
}

/** Whether anything matching the filter happened before `moment`: is there an earlier page. */
export async function hasActivityBefore(db: Database, moment: Date, filter: Omit<ActivityFilter, "to"> = {}) {
  const [row] = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(matching({ ...filter, to: moment }))
    .limit(1);
  return row !== undefined;
}

/** Everyone who can appear in the log, by name: the feed's "who" filter. */
export async function listPeople(db: Database) {
  return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
}
