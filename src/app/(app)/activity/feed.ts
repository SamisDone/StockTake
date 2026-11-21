import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";

/**
 * The activity page's shaping: which entries a URL asks for, and how a week of them is
 * laid out (by UTC day, with runs of sales folded). Plain module: no server or client code.
 */

export type FeedEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  summary: string;
  facts: Record<string, unknown> | null;
  occurredAt: Date;
  userName: string | null;
};

/** One line of a day: an entry, or a run of one person's sales folded into one. */
export type FeedItem =
  { kind: "entry"; entry: FeedEntry } | { kind: "sales"; userName: string | null; entries: FeedEntry[] };

export type FeedDay = { day: string; items: FeedItem[] };

/** What the filter can show, and the action prefixes behind each. */
export const KINDS = {
  all: { actions: [] as string[] },
  stock: { actions: ["stock."] },
  orders: { actions: ["purchase_order."] },
  catalog: { actions: ["product.", "supplier.", "user."] },
} as const;
export type Kind = keyof typeof KINDS;

/** A page of the feed is a week. */
export const PAGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * Groups newest-first entries by UTC day. Sales are most of the log (every unit sold
 * at the counter), so two or more in a row by the same person fold into one item that
 * opens to show them; everything else stands on its own line.
 */
export function groupFeed(entries: FeedEntry[]): FeedDay[] {
  const days: FeedDay[] = [];
  for (const entry of entries) {
    const day = dayOf(entry.occurredAt);
    let current = days.at(-1);
    if (current?.day !== day) {
      current = { day, items: [] };
      days.push(current);
    }
    const last = current.items.at(-1);
    if (entry.action !== "stock.sale") {
      current.items.push({ kind: "entry", entry });
    } else if (last?.kind === "sales" && last.userName === entry.userName) {
      last.entries.push(entry);
    } else if (last?.kind === "entry" && last.entry.action === "stock.sale" && last.entry.userName === entry.userName) {
      current.items[current.items.length - 1] = {
        kind: "sales",
        userName: entry.userName,
        entries: [last.entry, entry],
      };
    } else {
      current.items.push({ kind: "entry", entry });
    }
  }
  return days;
}

/** The URL's filters and page as the query reads them. Anything unknown falls back to the default. */
export function readFeedParams(params: { kind?: string; person?: string; before?: string }, now: Date) {
  const kind: Kind = params.kind && params.kind in KINDS ? (params.kind as Kind) : "all";
  const userId = params.person && /^[1-9]\d{0,8}$/.test(params.person) ? Number(params.person) : undefined;

  // The page ends before the start of `before`; by default, at the end of today.
  const latest = new Date(startOfDay(now).getTime() + DAY_MS);
  let to = latest;
  if (params.before && /^\d{4}-\d{2}-\d{2}$/.test(params.before)) {
    const asked = new Date(`${params.before}T00:00:00Z`);
    if (!Number.isNaN(asked.getTime()) && dayOf(asked) === params.before && asked < latest) to = asked;
  }
  return { kind, userId, from: new Date(to.getTime() - PAGE_DAYS * DAY_MS), to };
}

const RELATIVE: Record<Language, [string, string]> = { en: ["Today", "Yesterday"], bn: ["আজ", "গতকাল"] };

/** Whether a day is today or yesterday, which its heading names instead of the date. */
export function isRecentDay(day: string, now: Date) {
  return day === dayOf(now) || day === dayOf(new Date(startOfDay(now).getTime() - DAY_MS));
}

/** A day's heading: "Today", "Yesterday", else "Wednesday, Nov 18" ("বুধবার ১৮ নভেম্বর"). */
export function dayLabel(day: string, now: Date, language: Language = "en") {
  if (day === dayOf(now)) return RELATIVE[language][0];
  if (day === dayOf(new Date(startOfDay(now).getTime() - DAY_MS))) return RELATIVE[language][1];
  return formats(language).longDay(new Date(`${day}T00:00:00Z`));
}

/** The day a date input or URL holds, from a moment. */
export const dayParam = dayOf;
