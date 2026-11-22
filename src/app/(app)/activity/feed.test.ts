import { describe, expect, it } from "vitest";
import { type FeedEntry, dayLabel, groupFeed, readFeedParams } from "./feed";

/** A moment in November 2026 on Dhaka's clock (UTC+6). */
const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 10, day, hour - 6, minute));
const midnight = (day: number) => at(day, 0);
let next = 1;
const entry = (action: string, userName: string, occurredAt: Date): FeedEntry => ({
  id: next++,
  action,
  entityType: "product",
  entityId: 1,
  summary: action,
  facts: null,
  occurredAt,
  userName,
});

describe("groupFeed", () => {
  it("groups by Dhaka day and folds a run of one person's sales into one item", () => {
    const days = groupFeed([
      entry("stock.sale", "Jordan", at(21, 16)),
      entry("stock.sale", "Jordan", at(21, 15)),
      entry("stock.sale", "Jordan", at(21, 14)),
      entry("purchase_order.placed", "Avery", at(21, 12)),
      entry("stock.sale", "Jordan", at(21, 11)),
      entry("stock.sale", "Avery", at(21, 10)),
      entry("stock.sale", "Avery", at(20, 23, 59)),
    ]);

    expect(days.map((d) => d.day)).toEqual(["2026-11-21", "2026-11-20"]);
    expect(
      days[0].items.map((item) =>
        item.kind === "sales" ? `${item.entries.length} sales by ${item.userName}` : item.entry.action,
      ),
    ).toEqual(["3 sales by Jordan", "purchase_order.placed", "stock.sale", "stock.sale"]);
    // A run doesn't cross midnight.
    expect(days[1].items).toHaveLength(1);
  });

  it("starts the day at Dhaka midnight, not UTC's", () => {
    // 01:00 in Dhaka is still the evening before in UTC.
    const days = groupFeed([entry("stock.count", "Avery", at(21, 1)), entry("stock.count", "Avery", at(20, 23))]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-21", "2026-11-20"]);
  });
});

describe("readFeedParams", () => {
  const now = at(21, 9);

  it("defaults to everything, by everyone, in the week up to today", () => {
    expect(readFeedParams({}, now)).toEqual({
      kind: "all",
      userId: undefined,
      from: midnight(15),
      to: midnight(22),
    });
  });

  it("reads a kind, a person and the day a page ends before, ignoring anything else", () => {
    expect(readFeedParams({ kind: "orders", person: "2", before: "2026-11-15" }, now)).toEqual({
      kind: "orders",
      userId: 2,
      from: midnight(8),
      to: midnight(15),
    });
    expect(readFeedParams({ kind: "x", person: "-1", before: "2026-02-31" }, now)).toEqual(readFeedParams({}, now));
    // Never a page that starts in the future.
    expect(readFeedParams({ before: "2027-01-01" }, now)).toEqual(readFeedParams({}, now));
  });
});

describe("dayLabel", () => {
  const now = at(21, 9);
  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel("2026-11-21", now)).toBe("Today");
    expect(dayLabel("2026-11-20", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-18", now)).toBe("Wednesday, Nov 18");
    expect(dayLabel("2026-11-21", now, "bn")).toBe("আজ");
    expect(dayLabel("2026-11-18", now, "bn")).toBe("বুধবার ১৮ নভেম্বর");
  });
});
