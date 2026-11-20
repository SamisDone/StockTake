import { describe, expect, it } from "vitest";
import { centsToInput, parseCents, parseUnits } from "./parse";

describe("parseUnits", () => {
  it("reads whole units, with thousands separators and spaces", () => {
    expect(parseUnits("0")).toBe(0);
    expect(parseUnits(" 1,200 ")).toBe(1200);
    expect(parseUnits("1 200")).toBe(1200);
  });

  it("refuses anything that isn't a whole number", () => {
    for (const text of ["", " ", "2.5", "-1", "abc", "1e3", "+4"]) expect(parseUnits(text)).toBeNull();
  });
});

describe("parseCents", () => {
  it("reads dollars as cents, with or without a dollar sign or cents", () => {
    expect(parseCents("12")).toBe(1200);
    expect(parseCents("12.5")).toBe(1250);
    expect(parseCents("12.50")).toBe(1250);
    expect(parseCents("$1,234.05")).toBe(123405);
    expect(parseCents(" $ 0.99 ")).toBe(99);
    expect(parseCents(".75")).toBe(75);
    expect(parseCents("0")).toBe(0);
  });

  it("never goes through floating point", () => {
    // 1.13 * 100 is 112.99999999999999 in floating point.
    expect(parseCents("1.13")).toBe(113);
    expect(parseCents("4.35")).toBe(435);
  });

  it("refuses negative amounts, fractions of a cent and non-numbers", () => {
    for (const text of ["", "-1", "1.234", "12.", "$", "abc", "1.2.3", "1,2,"]) expect(parseCents(text)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("prints cents the way a person would type them back", () => {
    expect(centsToInput(1250)).toBe("12.50");
    expect(centsToInput(123405)).toBe("1234.05");
    expect(centsToInput(0)).toBe("0.00");
  });
});
