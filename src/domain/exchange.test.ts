import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { createTestDb } from "@/test/db";
import { REFRESH_AFTER_MS, RATE_SOURCES, getRate, isStale, readCurrency, refreshRate } from "./exchange";

const now = new Date(Date.UTC(2026, 10, 21, 9));
let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
});

const answer = (body: unknown, ok = true) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 503 }));
const published = (bdt: number, date = "2026-11-21") => ({ date, usd: { bdt, eur: 0.9 } });

describe("getRate", () => {
  it("starts from the migration's rate, already stale so the first request refreshes it", async () => {
    const rate = await getRate(db);
    expect(rate).toEqual({ perUsd: 124.6563, asOf: "2026-11-20", fetchedAt: new Date(0) });
    expect(isStale(rate, now)).toBe(true);
  });
});

describe("refreshRate", () => {
  it("stores the published rate and its day", async () => {
    const fetchRate = vi.fn(() => answer(published(124.9)));
    expect(await refreshRate(db, fetchRate, now)).toEqual({ perUsd: 124.9, asOf: "2026-11-21", fetchedAt: now });
    expect(fetchRate).toHaveBeenCalledWith(RATE_SOURCES[0], expect.anything());
    const stored = await getRate(db);
    expect(stored.perUsd).toBe(124.9);
    expect(isStale(stored, new Date(now.getTime() + REFRESH_AFTER_MS - 1))).toBe(false);
    expect(isStale(stored, new Date(now.getTime() + REFRESH_AFTER_MS))).toBe(true);
  });

  it("falls back to the mirror when the first source fails", async () => {
    const fetchRate = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("offline")))
      .mockImplementationOnce(() => answer(published(125.1)));
    expect((await refreshRate(db, fetchRate, now))?.perUsd).toBe(125.1);
    expect(fetchRate).toHaveBeenLastCalledWith(RATE_SOURCES[1], expect.anything());
  });

  it("keeps the last rate when no source gives a sane one", async () => {
    const garbage = vi
      .fn()
      .mockImplementationOnce(() => answer({ date: "today", usd: { bdt: "lots" } }))
      .mockImplementationOnce(() => answer(published(1.25)));
    expect(await refreshRate(db, garbage, now)).toBeNull();
    const down = vi.fn(() => answer({}, false));
    expect(await refreshRate(db, down, now)).toBeNull();
    expect((await getRate(db)).perUsd).toBe(124.6563);
  });
});

describe("readCurrency", () => {
  it("reads taka, and anything else as dollars", () => {
    expect([readCurrency("BDT"), readCurrency("USD"), readCurrency("bdt"), readCurrency(undefined)]).toEqual([
      "BDT",
      "USD",
      "USD",
      "USD",
    ]);
  });
});
