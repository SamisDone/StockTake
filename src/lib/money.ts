/**
 * Money as each person reads it. Amounts are stored in US cents; someone reading in taka
 * sees them converted at the day's rate, grouped the way Bangladesh writes numbers
 * (৳12,34,567). The formatter is plain data in, functions out, so the server builds it
 * from the person's preference and a client component gets the same preference as a prop.
 */

import type { Language } from "./i18n";

export const CURRENCIES = ["USD", "BDT"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type MoneyPrefs = {
  currency: Currency;
  /** Taka per US dollar. */
  bdtPerUsd: number;
  /** The day that rate was published, YYYY-MM-DD. */
  rateAsOf: string;
};

/** Dollars, for code with no person attached (tests, the activity log's own summaries). */
export const DOLLARS: MoneyPrefs = { currency: "USD", bdtPerUsd: 1, rateAsOf: "" };

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) formats.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}

export type MoneyFormat = ReturnType<typeof moneyFormat>;

const SIGNS: Record<Currency, string> = { USD: "$", BDT: "৳" };

/**
 * `language` sets the digits: Bangla prints Bangla digits, grouped in lakhs whatever the
 * currency, with the sign in front ("৳১২,৩৪,৫৬৭"), the way prices are written in Bangladesh.
 */
export function moneyFormat(prefs: MoneyPrefs, language: Language = "en") {
  const taka = prefs.currency === "BDT";
  /** US cents → the person's currency, in whole units (dollars or taka). */
  const amount = (cents: number) => (cents / 100) * (taka ? prefs.bdtPerUsd : 1);

  let exactOf: (units: number) => string;
  let wholeOf: (units: number) => string;
  let compactOf: (units: number) => string;
  if (language === "bn") {
    const sign = SIGNS[prefs.currency];
    const exact = numberFormat("bn-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const whole = numberFormat("bn-BD", { maximumFractionDigits: 0 });
    const compact = numberFormat("bn-BD", { notation: "compact", maximumFractionDigits: 1 });
    const signed = (format: Intl.NumberFormat) => (units: number) =>
      units < 0 ? `−${sign}${format.format(-units)}` : `${sign}${format.format(units)}`;
    exactOf = signed(exact);
    wholeOf = signed(whole);
    compactOf = signed(compact);
  } else {
    const locale = taka ? "en-IN" : "en-US";
    const base: Intl.NumberFormatOptions = {
      style: "currency",
      currency: prefs.currency,
      currencyDisplay: "narrowSymbol",
    };
    const exact = numberFormat(locale, base);
    const whole = numberFormat(locale, { ...base, maximumFractionDigits: 0 });
    const compact = numberFormat(locale, { ...base, notation: "compact", maximumFractionDigits: 1 });
    exactOf = (units) => exact.format(units);
    wholeOf = (units) => whole.format(units);
    compactOf = (units) => compact.format(units);
  }
  const wholeCents = (cents: number) => wholeOf(Math.round(amount(cents)));

  return {
    currency: prefs.currency,
    /** How many of the person's units (dollars or taka) one US dollar is. */
    perDollar: taka ? prefs.bdtPerUsd : 1,
    /** Exact, with cents or poisha: 11300 → "$113.00" or "৳14,086.16". */
    money: (cents: number) => exactOf(amount(cents)),
    /** Whole units, for totals printed large: "$1,827", "৳2,27,712". */
    whole: wholeCents,
    /** An axis label: whole under 10,000 units, compact above ("$12K", "৳1.2Cr"). */
    axis: (cents: number) => (Math.abs(amount(cents)) < 10_000 ? wholeCents(cents) : compactOf(amount(cents))),
    /** Whole units with a sign and a real minus: "+$1,250", "−৳80", "$0". */
    change: (cents: number) => {
      const units = Math.round(amount(cents));
      return units > 0 ? `+${wholeCents(cents)}` : units < 0 ? `−${wholeCents(-cents)}` : wholeCents(0);
    },
    /** Converts a typed dollar amount for a hint beside a dollar field: "≈ ৳305.40". Null in dollars. */
    hint: (cents: number) => (taka ? `≈ ${exactOf(amount(cents))}` : null),
  };
}
