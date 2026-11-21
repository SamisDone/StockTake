import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import type { Database } from "@/db/database";
import { createTestDb, scalar } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { claimQuestion, getAllowance, recordNeurons, releaseQuestion, usageDay } from "./usage";

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 10, day, hour));
const limits = { questionsPerDay: 3, neuronsPerDay: 100 };
let db: Database;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await seedBasics(db);
});

describe("usageDay", () => {
  it("is the UTC calendar day", () => {
    expect(usageDay(new Date(Date.UTC(2026, 10, 21, 23, 59)))).toBe("2026-11-21");
    expect(usageDay(new Date(Date.UTC(2026, 10, 22, 0, 0)))).toBe("2026-11-22");
  });
});

describe("claimQuestion", () => {
  it("counts each question against the person's day", async () => {
    expect(await claimQuestion(db, 1, at(21), limits)).toEqual({ ok: true, day: "2026-11-21", questionsLeft: 2 });
    expect(await claimQuestion(db, 1, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 1 });
    expect(await claimQuestion(db, 1, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 0 });
  });

  it("refuses once the person's questions for the day are used", async () => {
    for (let i = 0; i < 3; i++) await claimQuestion(db, 1, at(21), limits);
    expect(await claimQuestion(db, 1, at(21), limits)).toEqual({ ok: false, reason: "questions" });
    expect(await scalar(client, "SELECT questions FROM assistant_usage WHERE user_id = 1")).toBe(3);
  });

  it("keeps each person's count apart, and starts again the next UTC day", async () => {
    for (let i = 0; i < 3; i++) await claimQuestion(db, 1, at(21), limits);
    expect(await claimQuestion(db, 2, at(21), limits)).toMatchObject({ ok: true, questionsLeft: 2 });
    expect(await claimQuestion(db, 1, at(22, 0))).toMatchObject({ ok: true });
  });

  it("refuses everyone once the day's shared neurons are spent", async () => {
    await claimQuestion(db, 1, at(21), limits);
    await recordNeurons(db, 1, "2026-11-21", 100);
    expect(await claimQuestion(db, 2, at(21), limits)).toEqual({ ok: false, reason: "allowance" });
    // Yesterday's spending doesn't count today.
    expect(await claimQuestion(db, 2, at(22), limits)).toMatchObject({ ok: true });
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

describe("getAllowance", () => {
  it("says what's left for the person today and when it resets", async () => {
    expect(await getAllowance(db, 1, at(21, 15), limits)).toEqual({
      questionsPerDay: 3,
      questionsLeft: 3,
      allowanceLeft: true,
      resetsAt: new Date(Date.UTC(2026, 10, 22)),
    });
    await claimQuestion(db, 1, at(21), limits);
    await recordNeurons(db, 1, "2026-11-21", 99.5);
    expect(await getAllowance(db, 1, at(21, 15), limits)).toMatchObject({ questionsLeft: 2, allowanceLeft: true });
    await recordNeurons(db, 1, "2026-11-21", 0.5);
    expect(await getAllowance(db, 2, at(21, 15), limits)).toMatchObject({ questionsLeft: 3, allowanceLeft: false });
  });
});
