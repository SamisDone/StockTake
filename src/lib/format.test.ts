import { describe, expect, it } from "vitest";
import { formatCount, formatDays, formatMoney, formatWholeMoney } from "./format";

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

  it("groups thousands in counts", () => {
    expect(formatCount(12500)).toBe("12,500");
  });
});
