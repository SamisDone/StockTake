import { describe, expect, it } from "vitest";
import { untilMidnight } from "./reset-countdown";

// The demo starts over at midnight in Dhaka (UTC+6), which is 18:00 UTC.
describe("the time until the demo resets", () => {
  it("counts to the next Dhaka midnight", () => {
    expect(untilMidnight(Date.parse("2026-11-23T06:25:58Z"))).toBe("11:34:02"); // 12:25:58 in Dhaka
  });

  it("is a second away just before midnight", () => {
    expect(untilMidnight(Date.parse("2026-11-23T17:59:59Z"))).toBe("00:00:01");
  });

  it("starts a full day over at midnight itself", () => {
    expect(untilMidnight(Date.parse("2026-11-23T18:00:00Z"))).toBe("24:00:00");
  });

  it("rounds a part second up, so it never shows zero before the reset", () => {
    expect(untilMidnight(Date.parse("2026-11-23T17:59:59.500Z"))).toBe("00:00:01");
  });
});
