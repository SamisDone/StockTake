// Money is formatted per person, in src/lib/money.ts.

/** Days of cover: one decimal while it's short enough for tenths to matter, e.g. "3.4 days". */
export function formatDays(days: number) {
  const value = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${value} ${value === 1 ? "day" : "days"}`;
}

const count = new Intl.NumberFormat("en-US");

export function formatCount(n: number) {
  return count.format(n);
}

/** A signed movement, with a real minus sign, e.g. 12 → "+12", -3 → "−3". */
export function formatChange(n: number) {
  return n > 0 ? `+${formatCount(n)}` : n < 0 ? `−${formatCount(-n)}` : "0";
}

/** Units a day, to one decimal, e.g. 2.14 → "2.1 a day". */
export function formatRate(perDay: number) {
  return `${Math.round(perDay * 10) / 10} a day`;
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDateYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** A ledger date in UTC: "Nov 14", with the year only when it isn't the current one. */
export function formatDate(date: Date, now = new Date()) {
  return (date.getUTCFullYear() === now.getUTCFullYear() ? shortDate : shortDateYear).format(date);
}

/** Margin on the price, as a whole percentage: cost 250, price 900 → "72%". A dash without a price. */
export function formatMargin(costCents: number, priceCents: number) {
  if (priceCents === 0) return "–";
  const percent = Math.round(((priceCents - costCents) / priceCents) * 100);
  return percent < 0 ? `−${-percent}%` : `${percent}%`;
}

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/** A time of day in UTC, like every date in the app: "2:05 PM". */
export function formatTime(date: Date) {
  return time.format(date);
}

const weekdayDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A UTC day with its weekday, for a single day read off a chart: "Wed, Nov 18". */
export function formatDay(date: Date) {
  return weekdayDate.format(date);
}
