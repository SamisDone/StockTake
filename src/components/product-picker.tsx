"use client";

import { Search } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { rankMatch } from "@/lib/rank-match";

/** What the picker needs of a product; callers add whatever their rows print. */
export type Pickable = { id: number; name: string; sku: string };

/**
 * Adds a product to a list being written (an order's lines, a sale's): type part of a
 * name or SKU, pick with the arrows and Enter (or a click), and it's added; the field
 * clears for the next one. Groups keep their order; within one, the best match leads.
 * Each row prints the product's name and whatever the caller says about it.
 */
export function ProductPicker<T extends Pickable>({
  id,
  groups: given,
  placeholder,
  disabled,
  onPick,
  listLabel,
  noMatch,
  detail,
  aside,
}: {
  id: string;
  groups: { name: string | null; items: T[] }[];
  /** What the field says when empty: choose a product, or why there's nothing to choose. */
  placeholder: string;
  disabled: boolean;
  onPick: (product: T) => void;
  listLabel: string;
  noMatch: (query: string) => string;
  /** Under the name: the SKU and whatever else tells the products apart. */
  detail: (product: T) => ReactNode;
  /** At the row's end: a figure that helps the choice (a price, a suggested quantity). */
  aside?: (product: T) => ReactNode;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const match = (p: T) => rankMatch("", query, [p.name, p.sku]);
  const rank = (list: T[]) =>
    query.trim()
      ? list
          .map((p) => ({ p, score: match(p) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.p)
      : list;
  const groups = given
    .map((group) => ({ name: group.name, items: rank(group.items) }))
    .filter((g) => g.items.length > 0);
  const options = groups.flatMap((g) => g.items);
  const current = Math.min(active, options.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  const pick = (product: T) => {
    onPick(product);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };

  const showList = open && !disabled && options.length > 0;
  // Where each group's options start in the one list the arrow keys move through.
  const starts = groups.map((_, g) => groups.slice(0, g).reduce((sum, group) => sum + group.items.length, 0));

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
        id={id}
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
          aria-label={listLabel}
          // Keep focus in the field while choosing with the pointer.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 max-h-80 overflow-y-auto overscroll-contain border border-t-0 border-ink bg-label py-1 shadow-label"
        >
          {groups.map((group, g) => (
            <li key={group.name ?? "rest"} role="presentation">
              {group.name ? <p className="field-name px-3 pt-2 pb-1">{group.name}</p> : null}
              <ul role="group" aria-label={group.name ?? undefined}>
                {group.items.map((p, i) => {
                  const at = starts[g] + i;
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
                        <span className="block text-sm text-ink-2">{detail(p)}</span>
                      </span>
                      {aside ? <span className="shrink-0 text-right text-sm">{aside(p)}</span> : null}
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
          {noMatch(query.trim())}
        </p>
      ) : null}
    </div>
  );
}
