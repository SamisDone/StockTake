import { describe, expect, it } from "vitest";
import {
  formatAxisMoney,
  formatChange,
  formatDay,
  formatMoneyChange,
  formatCount,
  formatDate,
  formatDays,
  formatMargin,
  formatMoney,
  formatRate,
  formatWholeMoney,
} from "./format";

describe("format", () => {
  it("prints money from cents", () => {
    expect(formatMoney(11300)).toBe("$113.00");
    expect(formatWholeMoney(182670)).toBe("$1,827");
  });

  it("prints days of cover with tenths only while they matter", () => {
    expect(formatDays(0)).toBe("0 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(3.44)).toBe("3.4 days");
    expect(formatDays(9.96)).toBe("10 days");
    expect(formatDays(23.6)).toBe("24 days");
  });

  it("prints margin on the price, and a dash when there's no price", () => {
    expect(formatMargin(250, 900)).toBe("72%");
    expect(formatMargin(900, 900)).toBe("0%");
    expect(formatMargin(1200, 900)).toBe("−33%");
    expect(formatMargin(250, 0)).toBe("–");
  });

  it("groups thousands in counts", () => {
    expect(formatCount(12500)).toBe("12,500");
  });

  it("signs movements with a real minus sign", () => {
    expect(formatChange(1200)).toBe("+1,200");
    expect(formatChange(-3)).toBe("−3");
    expect(formatChange(0)).toBe("0");
  });

  it("prints demand per day to one decimal", () => {
    expect(formatRate(2.14)).toBe("2.1 a day");
    expect(formatRate(9)).toBe("9 a day");
  });

  it("prints ledger dates in UTC, with the year only when it differs", () => {
    const now = new Date(Date.UTC(2026, 10, 20));
    expect(formatDate(new Date(Date.UTC(2026, 10, 14, 23, 30)), now)).toBe("Nov 14");
    expect(formatDate(new Date(Date.UTC(2025, 11, 31)), now)).toBe("Dec 31, 2025");
  });

  it("prints a chart's day with its weekday, in UTC", () => {
    expect(formatDay(new Date(Date.UTC(2026, 10, 18, 23, 30)))).toBe("Wed, Nov 18");
  });

  it("prints axis money in full under $10,000 and compact from there", () => {
    expect(formatAxisMoney(250000)).toBe("$2,500");
    expect(formatAxisMoney(1200000)).toBe("$12K");
    expect(formatAxisMoney(0)).toBe("$0");
  });

  it("signs money changes with a real minus sign", () => {
    expect(formatMoneyChange(125000)).toBe("+$1,250");
    expect(formatMoneyChange(-8000)).toBe("−$80");
    expect(formatMoneyChange(20)).toBe("$0");
  });
});
