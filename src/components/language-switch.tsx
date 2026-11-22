"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Choice } from "@/components/choice";
import { PillRow } from "@/components/pill-row";
import { LANGUAGES, LANGUAGE_NAMES, LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { setLanguage } from "@/server/preference-actions";
import { COMPONENT_COPY } from "./copy";

/** Each language abbreviated in itself, for the phone bar where every pixel is spoken for. */
const SHORT_NAMES: Record<Language, string> = { en: "EN", bn: "বাং" };

/**
 * The language this person reads Stocktake in, kept in a cookie. Each language is named
 * in itself, so whoever can't read the current one still finds their own. After the
 * cookie is set the page is fetched again: the signed-out pages are prerendered once per
 * language and proxy.ts picks one by the cookie, so only a fresh request can change them.
 *
 * `tag` is the name tag's version (both choices, like the currency); `toggle` is one
 * button naming the other language, for the phone bar and the signed-out pages. On a
 * prerendered page (`prerendered`), which may be showing a /bn twin, it goes to the
 * page's plain address instead, so proxy.ts chooses again by the new cookie.
 */
export function LanguageSwitch({
  language,
  variant,
  prerendered = false,
  short = false,
}: {
  language: Language;
  variant: "tag" | "toggle";
  prerendered?: boolean;
  /** The phone bar's toggle: the other language abbreviated, its full name read out. */
  short?: boolean;
}) {
  const router = useRouter();
  const [shown, show] = useOptimistic(language);
  const [pending, startTransition] = useTransition();

  const choose = (next: Language) =>
    startTransition(async () => {
      show(next);
      const formData = new FormData();
      formData.set("language", next);
      await setLanguage(formData);
      if (prerendered) {
        const plain = location.pathname.replace(/^\/bn(?=\/|$)/, "") || "/";
        router.replace(`${plain}${location.search}` as Route, { scroll: false });
      } else {
        router.refresh();
      }
    });

  if (variant === "toggle") {
    const other = language === "en" ? "bn" : "en";
    return (
      <button
        type="button"
        lang={LANGUAGE_TAGS[other]}
        disabled={pending}
        aria-busy={pending}
        onClick={() => choose(other)}
        aria-label={short ? LANGUAGE_NAMES[other] : undefined}
        className={`press-quiet flex min-h-11 shrink-0 items-center rounded-control text-sm font-semibold text-ink-2 hover:bg-liner-deep hover:text-ink disabled:cursor-progress ${short ? "px-2" : "px-3"}`}
      >
        {short ? SHORT_NAMES[other] : LANGUAGE_NAMES[other]}
      </button>
    );
  }

  const t = COMPONENT_COPY[language];
  return (
    <fieldset aria-busy={pending} className="mt-3">
      <legend className="sr-only">{t.language}</legend>
      <p aria-hidden className="field-name">
        {t.language}
      </p>
      <PillRow className="-mx-1 mt-1 flex gap-1">
        {LANGUAGES.map((option) => (
          <Choice
            key={option}
            name="language"
            value={option}
            checked={shown === option}
            onSelect={() => choose(option)}
          >
            <span lang={LANGUAGE_TAGS[option]}>{LANGUAGE_NAMES[option]}</span>
          </Choice>
        ))}
      </PillRow>
    </fieldset>
  );
}
