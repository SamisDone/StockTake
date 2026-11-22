/**
 * The business's clock. Moments are stored as UTC instants; days — "today", a ledger
 * date, an order's due day, an analytics day, the assistant's daily questions — begin
 * at midnight in the business's time zone. Change the zone here and nowhere else.
 *
 * Bangladesh keeps no daylight saving, so one offset is exact all year and day
 * arithmetic stays plain addition (cheap on Workers, and usable in SQL). The tests
 * check that assumption; a zone with daylight saving would need per-instant offsets.
 *
 * Plain module with no imports: the seed script runs it under Node.
 */
export const BUSINESS_TIME_ZONE = "Asia/Dhaka";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds the zone's wall clock runs ahead of UTC at `at`, from Intl. */
export function zoneOffsetMs(timeZone: string, at: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/^GMT(?:([+-])(\d{2}):(\d{2}))?$/);
  if (!match) throw new Error(`Can't read the offset of ${timeZone}: ${name}`);
  if (!match[1]) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "-" ? -1 : 1) * minutes * 60 * 1000;
}

/** How far the business's clock runs ahead of UTC: six hours for Dhaka. */
export const BUSINESS_OFFSET_MS = zoneOffsetMs(BUSINESS_TIME_ZONE, new Date(0));

/** The business day a moment falls on, counted from 1970-01-01: the unit days are grouped by. */
export const dayNumber = (date: Date | number) =>
  Math.floor(((typeof date === "number" ? date : date.getTime()) + BUSINESS_OFFSET_MS) / DAY_MS);

/** The moment a business day (by `dayNumber`) begins: midnight on the business's clock. */
export const dayFromNumber = (n: number) => new Date(n * DAY_MS - BUSINESS_OFFSET_MS);

/** Midnight at the start of the business day `date` falls on. */
export const startOfDay = (date: Date) => dayFromNumber(dayNumber(date));

/** Midnight `days` business days after the start of `date`'s day (before, when negative). */
export const addDays = (date: Date, days: number) => dayFromNumber(dayNumber(date) + days);

/** Whole business days from `from`'s day to `to`'s day: Mon 23:50 to Tue 00:10 is 1. */
export const daysBetween = (from: Date, to: Date) => dayNumber(to) - dayNumber(from);

/** The business day a moment falls on, as YYYY-MM-DD: what URLs and date inputs hold. */
export const dayKey = (date: Date) => new Date(dayNumber(date) * DAY_MS).toISOString().slice(0, 10);

/** The midnight a YYYY-MM-DD business day begins at, or null when it isn't a real day. */
export function parseDayKey(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const utc = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== text) return null;
  return new Date(utc.getTime() - BUSINESS_OFFSET_MS);
}

/** The day of the week on the business's clock, 0 for Sunday. */
export const weekday = (date: Date) => new Date(dayNumber(date) * DAY_MS).getUTCDay();

/** The year on the business's clock. */
export const yearOf = (date: Date) => new Date(date.getTime() + BUSINESS_OFFSET_MS).getUTCFullYear();
