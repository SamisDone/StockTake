import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import type { Database } from "@/db/database";
import { createTestDb, scalar } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { budgetDay, claimQuestion, getAllowance, recordNeurons, releaseQuestion, usageDay } from "./usage";

/** A moment in November 2026 on Dhaka's clock (UTC+6). */
const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 10, day, hour - 6));
const claimOn = (day: string) => ({ day, budgetDay: day });
const limits = { questionsPerDay: 3, neuronsPerDay: 100 };
let db: Database;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await seedBasics(db);
});

describe("days", () => {
  it("counts questions by the day in Dhaka", () => {
    expect(usageDay(new Date("2026-11-21T17:59:00Z"))).toBe("2026-11-21");
    expect(usageDay(new Date("2026-11-21T18:00:00Z"))).toBe("2026-11-22");
  });

  it("counts the shared budget by the UTC day, when Workers AI resets its allocation", () => {
    expect(budgetDay(new Date("2026-11-21T18:00:00Z"))).toBe("2026-11-21");
    expect(budgetDay(new Date("2026-11-22T00:00:00Z"))).toBe("2026-11-22");
  });
});

describe("claimQuestion", () => {
  it("counts each question against the person's day", async () => {
    expect(await claimQuestion(db, 1, at(21), limits)).toEqual({
      ok: true,
      day: "2026-11-21",
      budgetDay: "2026-11-21",
      questionsLeft: 2,
    });
    expect(await claimQuestion(db, 1, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 1 });
    expect(await claimQuestion(db, 1, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 0 });
  });

  it("refuses once the person's questions for the day are used", async () => {
    for (let i = 0; i < 3; i++) await claimQuestion(db, 1, at(21), limits);
    expect(await claimQuestion(db, 1, at(21), limits)).toEqual({ ok: false, reason: "questions" });
    expect(await scalar(client, "SELECT questions FROM assistant_usage WHERE user_id = 1")).toBe(3);
  });

  it("keeps each person's count apart, and starts again at midnight in Dhaka", async () => {
    for (let i = 0; i < 3; i++) await claimQuestion(db, 1, at(21), limits);
    expect(await claimQuestion(db, 2, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 2 });
    expect(await claimQuestion(db, 1, at(22, 0))).toMatchObject({ ok: true });
  });

  it("refuses everyone once the day's shared neurons are spent, until 00:00 UTC", async () => {
    const claim = await claimQuestion(db, 1, at(21), limits);
    if (!claim.ok) throw new Error("expected a claim");
    await recordNeurons(db, 1, claim, 100);
    expect(await claimQuestion(db, 2, at(21), limits)).toEqual({ ok: false, reason: "allowance" });
    // 03:00 in Dhaka is a new day for questions, but still Cloudflare's day.
    expect(await claimQuestion(db, 2, at(22, 3), limits)).toEqual({ ok: false, reason: "allowance" });
    // 06:00 in Dhaka is 00:00 UTC: the allocation is back.
    expect(await claimQuestion(db, 2, at(22, 6), limits)).toMatchObject({ ok: true });
  });
});

describe("releaseQuestion", () => {
  it("gives back a question that got no answer, never below zero", async () => {
    await claimQuestion(db, 1, at(21), limits);
    await releaseQuestion(db, 1, "2026-11-21");
    await releaseQuestion(db, 1, "2026-11-21");
    expect(await scalar(client, "SELECT questions FROM assistant_usage WHERE user_id = 1")).toBe(0);
  });
});

describe("recordNeurons", () => {
  it("adds the cost to the person's day and to the shared budget", async () => {
    await claimQuestion(db, 1, at(21), limits);
    await recordNeurons(db, 1, claimOn("2026-11-21"), 40);
    await recordNeurons(db, 1, claimOn("2026-11-21"), 2);
    expect(await scalar(client, "SELECT neurons FROM assistant_usage WHERE user_id = 1")).toBe(42);
    expect(await scalar(client, "SELECT neurons FROM assistant_budget WHERE day = '2026-11-21'")).toBe(42);
  });
});

describe("getAllowance", () => {
  it("says what's left for the person today and when it resets", async () => {
    expect(await getAllowance(db, 1, at(21, 15), limits)).toEqual({
      questionsPerDay: 3,
      questionsLeft: 3,
      allowanceLeft: true,
      resetsAt: new Date("2026-11-21T18:00:00Z"),
      allowanceResetsAt: new Date("2026-11-22T00:00:00Z"),
    });
    await claimQuestion(db, 1, at(21), limits);
    await recordNeurons(db, 1, claimOn("2026-11-21"), 99.5);
    expect(await getAllowance(db, 1, at(21, 15), limits)).toMatchObject({ questionsLeft: 2, allowanceLeft: true });
    await recordNeurons(db, 1, claimOn("2026-11-21"), 0.5);
    expect(await getAllowance(db, 2, at(21, 15), limits)).toMatchObject({ questionsLeft: 3, allowanceLeft: false });
  });
});
