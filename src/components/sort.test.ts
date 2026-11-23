import { describe, expect, it } from "vitest";
import { nextSort, parseSort, sortParam, sortRows } from "./sort";

const KEYS = ["total", "lines"] as const;

describe("sort", () => {
  it("reads only known keys and directions from the hash", () => {
    expect(parseSort("total-asc", KEYS)).toEqual({ key: "total", dir: "asc" });
    expect(parseSort("name-asc", KEYS)).toBeNull();
    expect(parseSort("total-up", KEYS)).toBeNull();
    expect(parseSort(null, KEYS)).toBeNull();
    expect(sortParam(parseSort("lines-desc", KEYS))).toBe("lines-desc");
  });

  it("cycles largest first, smallest first, then the list's own order", () => {
    const first = nextSort(null, "total");
    expect(first).toEqual({ key: "total", dir: "desc" });
    const second = nextSort(first, "total");
    expect(second).toEqual({ key: "total", dir: "asc" });
    expect(nextSort(second, "total")).toBeNull();
    expect(nextSort(second, "lines")).toEqual({ key: "lines", dir: "desc" });
  });

  it("sorts stably and puts rows without a figure last either way", () => {
    const rows = [
      { id: 1, v: 5 },
      { id: 2, v: null },
      { id: 3, v: 9 },
      { id: 4, v: 5 },
    ];
    const by = (row: (typeof rows)[number]) => row.v;
    expect(sortRows(rows, { key: "total", dir: "desc" }, by).map((r) => r.id)).toEqual([3, 1, 4, 2]);
    expect(sortRows(rows, { key: "total", dir: "asc" }, by).map((r) => r.id)).toEqual([1, 4, 3, 2]);
    expect(sortRows(rows, null, by)).toBe(rows);
  });
});
