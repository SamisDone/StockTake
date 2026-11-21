"use client";

import { useOptimistic, useTransition } from "react";
import { Choice } from "@/components/choice";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type Currency, type MoneyPrefs } from "@/lib/money";
import { setCurrency } from "@/server/preference-actions";
import { COMPONENT_COPY } from "./copy";

const rateFormats: Record<Language, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  bn: new Intl.NumberFormat("bn-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/** "$1 = ৳124.66 on Nov 20": the rate taka is converted at, and the day it was published. */
export function rateLine(money: MoneyPrefs, language: Language) {
  const day = money.rateAsOf ? formats(language).date(new Date(`${money.rateAsOf}T00:00:00Z`)) : null;
  return COMPONENT_COPY[language].rate(rateFormats[language].format(money.bdtPerUsd), day);
}

const SIGNS: Record<Currency, string> = { USD: "$", BDT: "৳" };

/**
 * The currency this person reads money in, kept in a cookie. Choosing one flips the
 * mark at once and the page reprints its figures when the server answers. Stock is kept
 * in dollars, so taka is always a conversion, and the rate it's converted at is printed
 * beside the choice. `compact` is the phone bar's version: the signs only.
 */
export function CurrencySwitch({
  money,
  language,
  compact = false,
}: {
  money: MoneyPrefs;
  language: Language;
  compact?: boolean;
}) {
  const t = COMPONENT_COPY[language];
  const [shown, show] = useOptimistic(money.currency);
  const [pending, startTransition] = useTransition();

  const choose = (currency: Currency) =>
    startTransition(async () => {
      show(currency);
      const formData = new FormData();
      formData.set("currency", currency);
      await setCurrency(formData);
    });

  const choices = (["USD", "BDT"] as const).map((currency) => (
    <Choice
      key={currency}
      name={compact ? "currency-compact" : "currency"}
      value={currency}
      checked={shown === currency}
      onSelect={() => choose(currency)}
    >
      {compact ? (
        <>
          <span aria-hidden className="min-w-5 text-center text-base">
            {SIGNS[currency]}
          </span>
          <span className="sr-only">{t.currencies[currency]}</span>
        </>
      ) : (
        t.currencies[currency]
      )}
    </Choice>
  ));

  if (compact) {
    return (
      <fieldset aria-busy={pending} className="flex shrink-0 gap-1">
        <legend className="sr-only">
          {t.currency}
          {shown === "BDT" ? `, ${t.takaAt(rateLine(money, language))}` : ""}
        </legend>
        {choices}
      </fieldset>
    );
  }

  return (
    <fieldset aria-busy={pending} className="mt-3">
      <legend className="sr-only">{t.currency}</legend>
      <p aria-hidden className="field-name">
        {t.currency}
      </p>
      <div className="-mx-1 mt-1 flex gap-1">{choices}</div>
      {/* Holds its line in dollars too, so the tag doesn't grow when taka is chosen. */}
      <p className="mt-1 min-h-5 text-xs text-ink-2">{shown === "BDT" ? rateLine(money, language) : null}</p>
    </fieldset>
  );
}
