import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { assistantUsage } from "@/db/schema";
import { LIMITS } from "./config";

type Limits = typeof LIMITS;

/** The UTC day a moment falls on, as YYYY-MM-DD: the unit the allowance is counted in. */
export function usageDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

function nextDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

async function neuronsSpent(db: Database, day: string) {
  const [row] = await db
    .select({ neurons: sql<number>`coalesce(sum(${assistantUsage.neurons}), 0)`.mapWith(Number) })
    .from(assistantUsage)
    .where(eq(assistantUsage.day, day));
  return row.neurons;
}

export type Claim = { ok: true; day: string; questionsLeft: number } | { ok: false; reason: "questions" | "allowance" };

/**
 * Takes one of the person's questions for today, before the model is called. The
 * count only goes up while it's under the cap, in one statement, so two questions sent
 * at once can't both take the last one. The shared neuron budget is checked first.
 */
export async function claimQuestion(db: Database, userId: number, now: Date, limits: Limits = LIMITS): Promise<Claim> {
  const day = usageDay(now);
  if ((await neuronsSpent(db, day)) >= limits.neuronsPerDay) return { ok: false, reason: "allowance" };

  const [row] = await db
    .insert(assistantUsage)
    .values({ userId, day, questions: 1 })
    .onConflictDoUpdate({
      target: [assistantUsage.userId, assistantUsage.day],
      set: { questions: sql`${assistantUsage.questions} + 1` },
      setWhere: sql`${assistantUsage.questions} < ${limits.questionsPerDay}`,
    })
    .returning({ questions: assistantUsage.questions });

  if (!row) return { ok: false, reason: "questions" };
  return { ok: true, day, questionsLeft: limits.questionsPerDay - row.questions };
}

/** Gives a question back when it got no answer: the model failed, not the person. */
export async function releaseQuestion(db: Database, userId: number, day: string) {
  await db
    .update(assistantUsage)
    .set({ questions: sql`max(${assistantUsage.questions} - 1, 0)` })
    .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, day)));
}

/** Adds what a question's model calls cost to the day it was asked on. */
export async function recordNeurons(db: Database, userId: number, day: string, neurons: number) {
  if (!(neurons > 0)) return;
  await db
    .update(assistantUsage)
    .set({ neurons: sql`${assistantUsage.neurons} + ${neurons}` })
    .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, day)));
}

export type Allowance = Awaited<ReturnType<typeof getAllowance>>;

/** What the person can still ask today, and whether the shared budget has any left. */
export async function getAllowance(db: Database, userId: number, now: Date, limits: Limits = LIMITS) {
  const day = usageDay(now);
  const [[mine], spent] = await Promise.all([
    db
      .select({ questions: assistantUsage.questions })
      .from(assistantUsage)
      .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, day))),
    neuronsSpent(db, day),
  ]);
  return {
    questionsPerDay: limits.questionsPerDay,
    questionsLeft: Math.max(limits.questionsPerDay - (mine?.questions ?? 0), 0),
    allowanceLeft: spent < limits.neuronsPerDay,
    resetsAt: nextDay(now),
  };
}
