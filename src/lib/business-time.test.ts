import { describe, expect, it } from "vitest";
import {
  BUSINESS_OFFSET_MS,
  BUSINESS_TIME_ZONE,
  addDays,
  dayKey,
  daysBetween,
  parseDayKey,
  startOfDay,
  weekday,
  yearOf,
  zoneOffsetMs,
} from "./business-time";

const HOUR = 60 * 60 * 1000;

describe("the business clock", () => {
  it("runs on Dhaka time, six hours ahead of UTC", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Asia/Dhaka");
    expect(BUSINESS_OFFSET_MS).toBe(6 * HOUR);
  });

  it("has one offset all year, which the plain day arithmetic relies on", () => {
    for (let month = 0; month < 12; month++) {
      for (const year of [2026, 2027, 2030]) {
        expect(zoneOffsetMs(BUSINESS_TIME_ZONE, new Date(Date.UTC(year, month, 15)))).toBe(BUSINESS_OFFSET_MS);
      }
    }
  });

  it("reads offsets either side of UTC", () => {
    expect(zoneOffsetMs("UTC", new Date())).toBe(0);
    expect(zoneOffsetMs("America/New_York", new Date(Date.UTC(2026, 0, 15)))).toBe(-5 * HOUR);
    expect(zoneOffsetMs("Asia/Kathmandu", new Date(Date.UTC(2026, 0, 15)))).toBe(5.75 * HOUR);
  });

  it("starts the day at Dhaka midnight, which is 18:00 UTC the evening before", () => {
    expect(startOfDay(new Date("2026-11-21T18:00:00Z")).toISOString()).toBe("2026-11-21T18:00:00.000Z");
    expect(startOfDay(new Date("2026-11-22T17:59:59Z")).toISOString()).toBe("2026-11-21T18:00:00.000Z");
    expect(dayKey(new Date("2026-11-21T17:59:59Z"))).toBe("2026-11-21");
    expect(dayKey(new Date("2026-11-21T18:00:00Z"))).toBe("2026-11-22");
  });

  it("counts whole days on the business clock", () => {
    const lateMonday = new Date("2026-11-23T17:50:00Z"); // 23:50 Monday in Dhaka
    const earlyTuesday = new Date("2026-11-23T18:10:00Z"); // 00:10 Tuesday
    expect(daysBetween(lateMonday, earlyTuesday)).toBe(1);
    expect(weekday(lateMonday)).toBe(1);
    expect(weekday(earlyTuesday)).toBe(2);
    expect(addDays(lateMonday, 1).toISOString()).toBe("2026-11-23T18:00:00.000Z");
    expect(addDays(lateMonday, -1).toISOString()).toBe("2026-11-21T18:00:00.000Z");
  });

  it("reads a date input's day as its Dhaka midnight, and refuses days that don't exist", () => {
    expect(parseDayKey("2026-11-28")?.toISOString()).toBe("2026-11-27T18:00:00.000Z");
    expect(dayKey(parseDayKey("2026-11-28")!)).toBe("2026-11-28");
    expect(parseDayKey("2026-02-30")).toBeNull();
    expect(parseDayKey("28/11/2026")).toBeNull();
  });

  it("turns the year at Dhaka midnight", () => {
    expect(yearOf(new Date("2026-12-31T17:59:59Z"))).toBe(2026);
    expect(yearOf(new Date("2026-12-31T18:00:00Z"))).toBe(2027);
  });
});
