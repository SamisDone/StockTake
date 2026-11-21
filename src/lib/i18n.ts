/**
 * The two languages Stocktake is read in. Each person picks one (a cookie); English is
 * the default. Plain module: server and client code both use it.
 *
 * Copy lives beside the code that prints it, as `{ en, bn }` pairs where `bn` has the
 * same shape as `en`, so a missing translation is a type error, not a blank on screen.
 */

export const LANGUAGES = ["en", "bn"] as const;
export type Language = (typeof LANGUAGES)[number];

/** A cookie or form value as a language. Anything unknown is English. */
export function readLanguage(value: string | null | undefined): Language {
  return value === "bn" ? "bn" : "en";
}

/** Each language named in itself, the way a switch offers it. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", bn: "বাংলা" };

/** The BCP 47 tag for `lang` attributes. */
export const LANGUAGE_TAGS: Record<Language, string> = { en: "en", bn: "bn" };

/** Copy in both languages: Bangla must have every key English has. */
export type Copy<T> = { en: T; bn: T };

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Latin digits as Bangla digits: "PO 12" → "PO ১২". */
export function banglaDigits(text: string) {
  return text.replace(/[0-9]/g, (d) => BANGLA_DIGITS[Number(d)]);
}

/** Digits as the language writes them. English text is returned as is. */
export function localDigits(text: string, language: Language) {
  return language === "bn" ? banglaDigits(text) : text;
}

/** One piece of copy in both languages, e.g. a page title for `PageHeader`. */
export function both<T, R>(copy: Copy<T>, pick: (t: T) => R): Record<Language, R> {
  return { en: pick(copy.en), bn: pick(copy.bn) };
}
