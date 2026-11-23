"use client";

import { useEffect, useState } from "react";
import { Choice } from "@/components/choice";
import { PillRow } from "@/components/pill-row";
import type { Language } from "@/lib/i18n";
import { type ThemeChoice, THEME_CHOICES, applyThemeChoice, readThemeChoice, resolveTheme } from "@/lib/theme";
import { COMPONENT_COPY } from "./copy";

/**
 * Light, dark, or whatever the device says, beside language and currency. It applies at
 * once, in the browser: no request, nothing reprinted. Only mounted inside panels that
 * open on a click, so the cookie is already readable on its first render.
 */
export function ThemeSwitch({ language, name }: { language: Language; name: string }) {
  const t = COMPONENT_COPY[language];
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice);

  // Following the device: change with it while the switch is on screen too.
  useEffect(() => {
    if (choice !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => (document.documentElement.dataset.theme = resolveTheme("system"));
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  return (
    <fieldset className="mt-3">
      <legend className="sr-only">{t.theme}</legend>
      <p aria-hidden className="field-name">
        {t.theme}
      </p>
      <PillRow className="-mx-1 mt-1 flex gap-1">
        {THEME_CHOICES.map((option) => (
          <Choice
            key={option}
            name={name}
            value={option}
            checked={choice === option}
            onSelect={() => {
              setChoice(option);
              applyThemeChoice(option);
            }}
          >
            {t.themes[option]}
          </Choice>
        ))}
      </PillRow>
    </fieldset>
  );
}
