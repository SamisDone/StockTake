// Money is formatted per person, in src/lib/money.ts.
import type { Language } from "./i18n";

/**
 * Counts, dates and times in the reader's language. Every date in the app is a UTC
 * ledger date. Bangla prints Bangla digits, groups in lakhs (১২,৩৪,৫৬৭), and names
 * months and weekdays in Bangla. Build once per render with `formats(language)`.
 */
export type Formats = ReturnType<typeof build>;

const built = new Map<Language, Formats>();

export function formats(language: Language): Formats {
  let f = built.get(language);
  if (!f) built.set(language, (f = build(language)));
  return f;
}

function build(language: Language) {
  const bn = language === "bn";
  const locale = bn ? "bn-BD" : "en-US";
  const utc = { timeZone: "UTC" } as const;
  const number = new Intl.NumberFormat(locale);
  const tenths = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  // English abbreviates months ("Nov 14"); Bangla month names are short enough whole.
  const month = bn ? "long" : "short";
  const shortDate = new Intl.DateTimeFormat(locale, { ...utc, month, day: "numeric" });
  const shortDateYear = new Intl.DateTimeFormat(locale, { ...utc, month, day: "numeric", year: "numeric" });
  const dayDate = new Intl.DateTimeFormat(locale, { ...utc, weekday: "short", month, day: "numeric" });
  const longDayDate = new Intl.DateTimeFormat(locale, { ...utc, weekday: "long", month, day: "numeric" });
  const time = new Intl.DateTimeFormat(locale, {
    ...utc,
    hour: "numeric",
    minute: "2-digit",
    ...(bn ? { dayPeriod: "short" } : {}),
  });

  const count = (n: number) => number.format(n);
  /** Whole numbers below 10 keep one decimal: 3.44 → 3.4, 9.96 → 10, 23.6 → 24. */
  const roundDays = (days: number) => (days < 10 ? Math.round(days * 10) / 10 : Math.round(days));
  const days = (n: number) => {
    const value = roundDays(n);
    return bn ? `${tenths.format(value)} দিন` : `${tenths.format(value)} ${value === 1 ? "day" : "days"}`;
  };

  return {
    language,
    count,
    /** Days of cover: one decimal while it's short enough for tenths to matter, e.g. "3.4 days". */
    days,
    /** A signed movement, with a real minus sign, e.g. 12 → "+12", -3 → "−3". */
    change: (n: number) => (n > 0 ? `+${count(n)}` : n < 0 ? `−${count(-n)}` : count(0)),
    /** Units a day, to one decimal, e.g. 2.14 → "2.1 a day", "দিনে ২.১". */
    rate: (perDay: number) => {
      const value = tenths.format(Math.round(perDay * 10) / 10);
      return bn ? `দিনে ${value}` : `${value} a day`;
    },
    /** A ledger date in UTC: "Nov 14", with the year only when it isn't the current one. */
    date: (date: Date, now = new Date()) =>
      (date.getUTCFullYear() === now.getUTCFullYear() ? shortDate : shortDateYear).format(date),
    /** A UTC day with its weekday, for a single day read off a chart: "Wed, Nov 18". */
    day: (date: Date) => dayDate.format(date),
    /** A day heading: "Wednesday, Nov 18". */
    longDay: (date: Date) => longDayDate.format(date),
    /** A time of day in UTC: "2:05 PM"; in Bangla the part of the day comes first, "দুপুর ২:০৫". */
    time: (date: Date) => {
      if (!bn) return time.format(date);
      const parts = time.formatToParts(date);
      const period = parts.find((p) => p.type === "dayPeriod")?.value;
      const clock = parts
        .filter((p) => p.type !== "dayPeriod")
        .map((p) => p.value)
        .join("")
        .trim();
      return period ? `${period} ${clock}` : clock;
    },
    /** Margin on the price, as a whole percentage: cost 250, price 900 → "72%". A dash without a price. */
    margin: (costCents: number, priceCents: number) => {
      if (priceCents === 0) return "–";
      const percent = Math.round(((priceCents - costCents) / priceCents) * 100);
      return percent < 0 ? `−${count(-percent)}%` : `${count(percent)}%`;
    },
  };
}
