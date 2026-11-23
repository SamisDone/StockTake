"use client";

import { Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ProductChoice } from "./draft-values";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { rankMatch } from "@/lib/rank-match";
import { ORDERS_COPY } from "./copy";

/**
 * Adds a product to a draft: type part of a name or SKU, pick with the arrows and
 * Enter (or a click), and it's on the order; the field clears for the next one.
 * Running-low products come first with the quantity the forecast suggests; each row
 * shows what the choice needs: SKU, units on hand, and the usual cost.
 */
export function ProductPicker({
  low,
  rest,
  placeholder,
  disabled,
  onPick,
  money,
  language,
}: {
  low: ProductChoice[];
  rest: ProductChoice[];
  /** What the field says when empty: choose a product, or why there's nothing to choose. */
  placeholder: string;
  disabled: boolean;
  onPick: (product: ProductChoice) => void;
  money: MoneyPrefs;
  language: Language;
}) {
  const t = ORDERS_COPY[language].form;
  const f = formats(language);
  const m = moneyFormat(money, language);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const match = (p: ProductChoice) => rankMatch("", query, [p.name, p.sku]);
  const rank = (list: ProductChoice[]) =>
    query.trim()
      ? list
          .map((p) => ({ p, score: match(p) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.p)
      : list;
  const groups = [
    { name: t.runningLow, items: rank(low) },
    { name: low.length > 0 ? t.everythingElse : null, items: rank(rest) },
  ].filter((g) => g.items.length > 0);
  const options = groups.flatMap((g) => g.items);
  const current = Math.min(active, options.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  const pick = (product: ProductChoice) => {
    onPick(product);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };

  const showList = open && !disabled && options.length > 0;
  let index = -1;

  return (
    <div className="relative">
      <Search
        aria-hidden
        size={18}
        strokeWidth={2.25}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-2"
      />
      <input
        ref={input}
        id="add-product"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && current >= 0 ? optionId(current) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (!showList) return;
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current + step + options.length) % options.length);
          } else if (event.key === "Enter") {
            // Never submit the form from here: Enter picks.
            event.preventDefault();
            if (showList && options[current]) pick(options[current]);
          } else if (event.key === "Escape" && showList) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-none border border-ink bg-label pr-2.5 pl-9 text-base font-medium outline-none placeholder:font-normal placeholder:text-ink-2 focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] disabled:border-hairline disabled:placeholder:text-ink-3"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.addProduct}
          // Keep focus in the field while choosing with the pointer.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 max-h-80 overflow-y-auto overscroll-contain border border-t-0 border-ink bg-label py-1 shadow-label"
        >
          {groups.map((group) => (
            <li key={group.name ?? "rest"} role="presentation">
              {group.name ? <p className="field-name px-3 pt-2 pb-1">{group.name}</p> : null}
              <ul role="group" aria-label={group.name ?? undefined}>
                {group.items.map((p) => {
                  index += 1;
                  const at = index;
                  return (
                    <li
                      key={p.id}
                      id={optionId(at)}
                      role="option"
                      aria-selected={at === current}
                      onMouseMove={() => setActive(at)}
                      onClick={() => pick(p)}
                      className={`flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 ${at === current ? "bg-liner" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block text-sm text-ink-2">
                          <span className="font-mono text-xs">{p.sku}</span> · {t.pickerOnHand(f.count(p.onHand))}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        {p.suggested > 0 ? (
                          <span className="block font-semibold">{t.pickerOrder(f.count(p.suggested))}</span>
                        ) : null}
                        <span className="block text-ink-2">{t.pickerCost(m.money(p.unitCostCents))}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !disabled && query.trim() && options.length === 0 ? (
        <p
          role="status"
          className="absolute inset-x-0 top-full z-20 border border-t-0 border-ink bg-label px-3 py-3 text-ink-2 shadow-label"
        >
          {t.pickerNoMatch(query.trim())}
        </p>
      ) : null}
    </div>
  );
}
