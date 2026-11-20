import { and, desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/db/database";
import { activityLog, users } from "@/db/schema";
import type { Actor } from "./actor";

export type ActivityEntry = {
  action: string;
  entityType: "product" | "supplier" | "purchase_order" | "user";
  /** A number, or SQL that resolves to the new row's ID inside a batch. */
  entityId: number | SQL<number>;
  summary: string;
};

/** The insert for one activity entry, to go in the same batch as the change it describes. */
export function logActivity(db: Database, actor: Actor, entry: ActivityEntry, now: Date) {
  return db.insert(activityLog).values({ ...entry, userId: actor.id, occurredAt: now });
}

/** The activity feed, newest first, optionally for one entity. */
export async function listActivity(
  db: Database,
  { entityType, entityId, limit = 50 }: { entityType?: ActivityEntry["entityType"]; entityId?: number; limit?: number } = {},
) {
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      summary: activityLog.summary,
      occurredAt: activityLog.occurredAt,
      userName: users.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId))
    .where(
      and(
        entityType ? eq(activityLog.entityType, entityType) : undefined,
        entityId !== undefined ? eq(activityLog.entityId, entityId) : undefined,
      ),
    )
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .limit(limit);
}
