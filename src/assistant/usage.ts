import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/database";
import { assistantBudget, assistantUsage } from "@/db/schema";
import { addDays, dayKey } from "@/lib/business-time";
import { LIMITS } from "./config";

type Limits = typeof LIMITS;

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

/** The business day a moment falls on, as YYYY-MM-DD: the unit each person's questions are counted in. */
export const usageDay = dayKey;

/**
 * The UTC day a moment falls on, as YYYY-MM-DD: the unit the shared neuron budget is
 * counted in, because Workers AI resets its free allocation at 00:00 UTC.
 */
export const budgetDay = (now: Date) => now.toISOString().slice(0, 10);

const nextUtcMidnight = (now: Date) => new Date((Math.floor(now.getTime() / UTC_DAY_MS) + 1) * UTC_DAY_MS);

async function neuronsSpent(db: Database, day: string) {
  const [row] = await db
    .select({ neurons: assistantBudget.neurons })
    .from(assistantBudget)
    .where(eq(assistantBudget.day, day));
  return row?.neurons ?? 0;
}

export type Claim =
  | { ok: true; day: string; budgetDay: string; questionsLeft: number }
  | { ok: false; reason: "questions" | "allowance" };

/**
 * Takes one of the person's questions for today, before the model is called. The
 * count only goes up while it's under the cap, in one statement, so two questions sent
 * at once can't both take the last one. The shared neuron budget is checked first.
 */
export async function claimQuestion(db: Database, userId: number, now: Date, limits: Limits = LIMITS): Promise<Claim> {
  const day = usageDay(now);
  const budget = budgetDay(now);
  if ((await neuronsSpent(db, budget)) >= limits.neuronsPerDay) return { ok: false, reason: "allowance" };

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
  return { ok: true, day, budgetDay: budget, questionsLeft: limits.questionsPerDay - row.questions };
}

/** Gives a question back when it got no answer: the model failed, not the person. */
export async function releaseQuestion(db: Database, userId: number, day: string) {
  await db
    .update(assistantUsage)
    .set({ questions: sql`max(${assistantUsage.questions} - 1, 0)` })
    .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, day)));
}

/** Adds what a question's model calls cost to the person's day and to the shared budget, together. */
export async function recordNeurons(
  db: Database,
  userId: number,
  claim: { day: string; budgetDay: string },
  neurons: number,
) {
  if (!(neurons > 0)) return;
  await db.batch([
    db
      .update(assistantUsage)
      .set({ neurons: sql`${assistantUsage.neurons} + ${neurons}` })
      .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, claim.day))),
    db
      .insert(assistantBudget)
      .values({ day: claim.budgetDay, neurons })
      .onConflictDoUpdate({
        target: assistantBudget.day,
        set: { neurons: sql`${assistantBudget.neurons} + ${neurons}` },
      }),
  ]);
}

export type Allowance = Awaited<ReturnType<typeof getAllowance>>;

/** What the person can still ask today, and whether the shared budget has any left. */
export async function getAllowance(db: Database, userId: number, now: Date, limits: Limits = LIMITS) {
  const [[mine], spent] = await Promise.all([
    db
      .select({ questions: assistantUsage.questions })
      .from(assistantUsage)
      .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, usageDay(now)))),
    neuronsSpent(db, budgetDay(now)),
  ]);
  return {
    questionsPerDay: limits.questionsPerDay,
    questionsLeft: Math.max(limits.questionsPerDay - (mine?.questions ?? 0), 0),
    allowanceLeft: spent < limits.neuronsPerDay,
    /** When the person's questions come back: the business's next midnight. */
    resetsAt: addDays(now, 1),
    /** When the shared budget comes back: Cloudflare's next midnight, 6:00 AM in Dhaka. */
    allowanceResetsAt: nextUtcMidnight(now),
  };
}
