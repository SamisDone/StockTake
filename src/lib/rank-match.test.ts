import { describe, expect, it } from "vitest";
import { rankMatch } from "./rank-match";

const rank = (search: string, ...keywords: string[]) => rankMatch("row", search, keywords);

describe("rankMatch", () => {
  it("keeps every row while nothing is typed", () => {
    expect(rank("  ", "Widget")).toBe(1);
  });

  it("ranks a row that starts with the query above one with a word that does, above anywhere", () => {
    expect(rank("hex", "Hex bolts M8, 50")).toBe(1);
    expect(rank("bolts", "Hex bolts M8, 50")).toBe(0.8);
    expect(rank("olts", "Hex bolts M8, 50")).toBe(0.6);
  });

  it("matches order numbers exactly, not as scattered letters", () => {
    expect(rank("PO-008", "PO-0089", "Northline Electronics", "Placed")).toBe(1);
    expect(rank("PO-008", "Ballpoint pens, black, 10 pack", "OFC-PEN-BLK")).toBe(0);
  });

  it("matches a SKU as well as a name", () => {
    expect(rank("elc-usb", "USB-C cable, 1 m", "ELC-USB-C")).toBe(0.8);
  });

  it("finds every typed word, in any order", () => {
    expect(rank("tape 48", "Packing tape, 48 mm")).toBe(0.4);
    expect(rank("tape 50", "Packing tape, 48 mm")).toBe(0);
  });
});
