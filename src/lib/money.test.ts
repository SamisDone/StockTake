import { describe, expect, it } from "vitest";
import { DOLLARS, moneyFormat } from "./money";

const taka = moneyFormat({ currency: "BDT", bdtPerUsd: 124.5, rateAsOf: "2026-11-21" });
const dollars = moneyFormat(DOLLARS);

describe("moneyFormat", () => {
  it("prints dollars as before", () => {
    expect(dollars.money(11300)).toBe("$113.00");
    expect(dollars.whole(182670)).toBe("$1,827");
    expect(dollars.axis(250000)).toBe("$2,500");
    expect(dollars.axis(1_250_000)).toBe("$12.5K");
    expect(dollars.axis(1_200_000)).toBe("$12K");
    expect(dollars.axis(0)).toBe("$0");
    expect([dollars.change(125000), dollars.change(-8000), dollars.change(20)]).toEqual(["+$1,250", "−$80", "$0"]);
    expect(dollars.hint(100)).toBeNull();
  });

  it("converts cents to taka at the rate, grouped in lakhs and crores", () => {
    expect(taka.money(100)).toBe("৳124.50");
    expect(taka.whole(1_000_000)).toBe("৳12,45,000");
    expect(taka.axis(4000)).toBe("৳4,980");
    expect(taka.axis(10_000_000)).toBe("৳1.2Cr");
    expect(taka.change(-100)).toBe("−৳125");
    expect(taka.hint(245)).toBe("≈ ৳305.03");
  });

  it("prints Bangla digits in Bangla", () => {
    const bn = moneyFormat({ currency: "BDT", bdtPerUsd: 100, rateAsOf: "2026-11-21" }, "bn");
    expect(bn.whole(1_234_500)).toBe("১২,৩৪,৫০০৳");
  });
});
