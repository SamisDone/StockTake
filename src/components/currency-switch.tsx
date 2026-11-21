"use client";

import { useOptimistic, useTransition } from "react";
import { Choice } from "@/components/choice";
import { formatDate } from "@/lib/format";
import { type Currency, type MoneyPrefs } from "@/lib/money";
import { setCurrency } from "@/server/preference-actions";

const rateFormat = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1 = ৳124.66 on Nov 20": the rate taka is converted at, and the day it was published. */
export function rateLine(money: MoneyPrefs) {
  const day = money.rateAsOf ? formatDate(new Date(`${money.rateAsOf}T00:00:00Z`)) : null;
  return `$1 = ৳${rateFormat.format(money.bdtPerUsd)}${day ? ` on ${day}` : ""}`;
}

const NAMES: Record<Currency, string> = { USD: "Dollars", BDT: "Taka" };
const SIGNS: Record<Currency, string> = { USD: "$", BDT: "৳" };

/**
 * The currency this person reads money in, kept in a cookie. Choosing one flips the
 * mark at once and the page reprints its figures when the server answers. Stock is kept
 * in dollars, so taka is always a conversion, and the rate it's converted at is printed
 * beside the choice. `compact` is the phone bar's version: the signs only.
 */
export function CurrencySwitch({ money, compact = false }: { money: MoneyPrefs; compact?: boolean }) {
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
          <span className="sr-only">{NAMES[currency]}</span>
        </>
      ) : (
        NAMES[currency]
      )}
    </Choice>
  ));

  if (compact) {
    return (
      <fieldset aria-busy={pending} className="flex shrink-0 gap-1">
        <legend className="sr-only">Currency{shown === "BDT" ? `, taka at ${rateLine(money)}` : ""}</legend>
        {choices}
      </fieldset>
    );
  }

  return (
    <fieldset aria-busy={pending} className="mt-3">
      <legend className="sr-only">Currency</legend>
      <p aria-hidden className="field-name">
        Currency
      </p>
      <div className="-mx-1 mt-1 flex gap-1">{choices}</div>
      {/* Holds its line in dollars too, so the tag doesn't grow when taka is chosen. */}
      <p className="mt-1 min-h-5 text-xs text-ink-2">{shown === "BDT" ? rateLine(money) : null}</p>
    </fieldset>
  );
}
