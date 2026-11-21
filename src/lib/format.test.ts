import { describe, expect, it } from "vitest";
import { formats } from "./format";
import { banglaDigits, localDigits, readLanguage } from "./i18n";

const en = formats("en");
const bn = formats("bn");

describe("formats in English", () => {
  it("prints days of cover with tenths only while they matter", () => {
    expect(en.days(0)).toBe("0 days");
    expect(en.days(1)).toBe("1 day");
    expect(en.days(3.44)).toBe("3.4 days");
    expect(en.days(9.96)).toBe("10 days");
    expect(en.days(23.6)).toBe("24 days");
  });

  it("prints margin on the price, and a dash when there's no price", () => {
    expect(en.margin(250, 900)).toBe("72%");
    expect(en.margin(900, 900)).toBe("0%");
    expect(en.margin(1200, 900)).toBe("−33%");
    expect(en.margin(250, 0)).toBe("–");
  });

  it("groups thousands in counts", () => {
    expect(en.count(12500)).toBe("12,500");
  });

  it("signs movements with a real minus sign", () => {
    expect(en.change(1200)).toBe("+1,200");
    expect(en.change(-3)).toBe("−3");
    expect(en.change(0)).toBe("0");
  });

  it("prints demand per day to one decimal", () => {
    expect(en.rate(2.14)).toBe("2.1 a day");
    expect(en.rate(9)).toBe("9 a day");
  });

  it("prints ledger dates in UTC, with the year only when it differs", () => {
    const now = new Date(Date.UTC(2026, 10, 20));
    expect(en.date(new Date(Date.UTC(2026, 10, 14, 23, 30)), now)).toBe("Nov 14");
    expect(en.date(new Date(Date.UTC(2025, 11, 31)), now)).toBe("Dec 31, 2025");
  });

  it("prints a chart's day with its weekday, in UTC", () => {
    expect(en.day(new Date(Date.UTC(2026, 10, 18, 23, 30)))).toBe("Wed, Nov 18");
  });

  it("prints times of day in UTC", () => {
    expect(en.time(new Date(Date.UTC(2026, 10, 18, 14, 5)))).toBe("2:05 PM");
  });
});

describe("formats in Bangla", () => {
  it("prints Bangla digits, grouped in lakhs", () => {
    expect(bn.count(1234567)).toBe("১২,৩৪,৫৬৭");
    expect(bn.change(-3)).toBe("−৩");
    expect(bn.days(3.44)).toBe("৩.৪ দিন");
    expect(bn.rate(2.14)).toBe("দিনে ২.১");
    expect(bn.margin(250, 900)).toBe("৭২%");
  });

  it("names months and weekdays in Bangla", () => {
    const now = new Date(Date.UTC(2026, 10, 20));
    expect(bn.date(new Date(Date.UTC(2026, 10, 14)), now)).toBe("১৪ নভেম্বর");
    expect(bn.date(new Date(Date.UTC(2025, 11, 31)), now)).toBe("৩১ ডিসেম্বর, ২০২৫");
  });

  it("puts the part of the day before the time", () => {
    expect(bn.time(new Date(Date.UTC(2026, 10, 18, 14, 5)))).toBe("দুপুর ২:০৫");
  });
});

describe("i18n", () => {
  it("reads a language, defaulting to English", () => {
    expect(readLanguage("bn")).toBe("bn");
    expect(readLanguage("fr")).toBe("en");
    expect(readLanguage(undefined)).toBe("en");
  });

  it("swaps digits only in Bangla", () => {
    expect(banglaDigits("PO-0012 at 9:05")).toBe("PO-০০১২ at ৯:০৫");
    expect(localDigits("12", "en")).toBe("12");
    expect(localDigits("12", "bn")).toBe("১২");
  });
});
