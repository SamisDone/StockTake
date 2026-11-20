"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StockStatus } from "@/domain/forecast";
import { Choice } from "@/components/choice";
import { CoverBar, MobileName, StatusMark, Tally, Th } from "@/components/stock";
import { formatCount, formatMoney, formatWholeMoney } from "@/lib/format";

export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  status: StockStatus;
  onHand: number;
  reorderPoint: number;
  daysOfCover: number | null;
  leadTimeDays: number;
  valueCents: number;
};

type Show = "all" | "attention";

/**
 * The catalog, searchable and filtered by category and status. The catalog is tens of
 * products, so every product is sent once and filtered here: typing costs no request.
 * The filters live in the URL, so a filtered list can be shared or reloaded.
 */
export function ProductTable({ rows, categories }: { rows: ProductRow[]; categories: string[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [category, setCategory] = useState(() => {
    const wanted = params.get("category");
    return wanted && categories.includes(wanted) ? wanted : "";
  });
  const [show, setShow] = useState<Show>(() => (params.get("show") === "attention" ? "attention" : "all"));

  // Mirror the filters into the URL without a navigation. Only on the list itself: with a
  // product open over it, the URL is the product's.
  useEffect(() => {
    if (pathname !== "/products") return;
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (category) next.set("category", category);
    if (show === "attention") next.set("show", "attention");
    const search = next.size ? `?${next}` : "";
    if (search !== window.location.search) window.history.replaceState(null, "", `${pathname}${search}`);
  }, [pathname, query, category, show]);

  const needle = query.trim().toLowerCase();
  const inCategory = category ? rows.filter((row) => row.category === category) : rows;
  const attentionCount = inCategory.filter((row) => row.status !== "ok").length;
  const shown = inCategory.filter(
    (row) =>
      (show === "all" || row.status !== "ok") &&
      (!needle || row.name.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)),
  );
  const units = shown.reduce((sum, row) => sum + row.onHand, 0);
  const value = shown.reduce((sum, row) => sum + row.valueCents, 0);

  // Switching category or status is the same place with different content, so the new
  // content fades in (never on first render); typing a search doesn't animate at all. A
  // CSS fade, not a view transition: rows stay clickable while it runs, where a view
  // transition would swallow a quick click on the table it names.
  const [switches, setSwitches] = useState(0);
  const choose = (update: () => void) => {
    update();
    setSwitches((n) => n + 1);
  };

  return (
    <>
      <div className="grid border-b-2 border-ink lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)_auto]">
        <SearchField query={query} onChange={setQuery} />

        <Choices legend="Category" className="lg:border-l">
          <Choice name="category" checked={category === ""} onSelect={() => choose(() => setCategory(""))}>
            All
          </Choice>
          {categories.map((name) => (
            <Choice
              key={name}
              name="category"
              checked={category === name}
              onSelect={() => choose(() => setCategory(name))}
            >
              {name}
            </Choice>
          ))}
        </Choices>

        <Choices legend="Show" className="lg:border-l">
          <Choice name="show" checked={show === "all"} onSelect={() => choose(() => setShow("all"))}>
            All
          </Choice>
          <Choice name="show" checked={show === "attention"} onSelect={() => choose(() => setShow("attention"))}>
            Needs attention <span className="ml-1.5">{formatCount(attentionCount)}</span>
          </Choice>
        </Choices>
      </div>

      <div key={`${category}|${show}`} className={switches > 0 ? "swap-in" : undefined}>
        <dl className="grid grid-cols-3 border-b-2 border-ink">
          <Tally name="Products" value={shown.length}>
            {/* Always printed, hidden when nothing is filtered, so filtering never
                  changes the zone's height. */}
            <p
              aria-hidden={shown.length === rows.length || undefined}
              className={`mt-1 text-sm text-ink-2 ${shown.length === rows.length ? "invisible" : ""}`}
            >
              of {formatCount(rows.length)}
            </p>
          </Tally>
          <Tally name="Units on hand" value={units} />
          <Tally name="Value at cost" value={formatWholeMoney(value)} />
        </dl>

        <section aria-label="Products" className="pt-2 pb-8">
          {shown.length === 0 ? (
            <Empty
              query={query.trim()}
              category={category}
              show={show}
              onClear={() => {
                setQuery("");
                document.getElementById("product-search")?.focus();
              }}
            />
          ) : (
            <table className="w-full border-collapse text-left max-md:block">
              <caption className="sr-only">
                {formatCount(shown.length)} products, by name. Select a product to see its ledger and record stock.
              </caption>
              <thead className="max-md:hidden">
                <tr className="border-b border-ink">
                  <Th>Product</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">Reorder at</Th>
                  <Th className="w-[28%]">Cover</Th>
                  <Th align="right">Value at cost</Th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {shown.map((row) => (
                  <Row key={row.id} row={row} selected={pathname === `/products/${row.id}`} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

/** One product: the name opens its label over the list, and the whole row is the hit area. */
function Row({ row, selected }: { row: ProductRow; selected: boolean }) {
  return (
    <tr
      className={`relative border-b border-hairline align-top transition-colors duration-150 last:border-b-0 max-md:grid max-md:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8 ${
        selected ? "bg-liner" : "hover:bg-liner/60"
      }`}
    >
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0 md:pl-8">
        <div className="flex items-baseline gap-2">
          <StatusMark status={row.status} />
          <Link
            href={`/products/${row.id}`}
            prefetch={false}
            scroll={false}
            className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {row.name}
          </Link>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          <span className="font-mono text-xs">{row.sku}</span>
          {row.category ? <> · {row.category}</> : null}
        </p>
      </td>
      <td className="tabular py-3 pr-4 text-right text-lg font-semibold max-md:p-0 max-md:text-left">
        <MobileName>On hand</MobileName>
        {formatCount(row.onHand)}
      </td>
      <td className="tabular py-3 pr-4 text-right text-ink-2 max-md:hidden">{formatCount(row.reorderPoint)}</td>
      <td className="py-3 pr-6 max-md:p-0">
        <MobileName>Cover</MobileName>
        <CoverBar daysOfCover={row.daysOfCover} leadTimeDays={row.leadTimeDays} />
      </td>
      <td className="tabular py-3 text-right max-md:p-0 max-md:text-left md:pr-8">
        <MobileName>Value</MobileName>
        {formatMoney(row.valueCents)}
      </td>
    </tr>
  );
}

/** The search field, boxed like every field on a label. "/" jumps to it from anywhere on the page. */
function SearchField({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) {
        return;
      }
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="border-b border-ink px-5 pt-2.5 pb-1.5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] sm:px-8 lg:border-b-0">
      <label htmlFor="product-search" className="field-name block">
        Search
      </label>
      <div className="flex items-center gap-2">
        <Search aria-hidden size={18} strokeWidth={2} className="shrink-0 text-ink-3" />
        <input
          ref={input}
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              onChange("");
            }
          }}
          placeholder="Name or SKU"
          aria-keyshortcuts="/"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="field-input min-w-0 flex-1 placeholder:text-ink-3"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
            aria-label="Clear search"
            className="-mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-liner hover:text-ink"
          >
            <X aria-hidden size={18} strokeWidth={2} />
          </button>
        ) : (
          <span aria-hidden className="size-11 shrink-0" />
        )}
      </div>
    </div>
  );
}

/** A boxed field holding a row of choices: native radios, so arrow keys move between them. */
function Choices({ legend, className = "", children }: { legend: string; className?: string; children: ReactNode }) {
  return (
    <fieldset className={`min-w-0 border-b border-ink pt-2.5 pb-2 last:border-b-0 lg:border-b-0 ${className}`}>
      <legend className="sr-only">{legend}</legend>
      <p aria-hidden className="field-name px-5 sm:px-8">
        {legend}
      </p>
      {/* On a phone the choices scroll sideways rather than wrap. */}
      <div className="mt-1 flex gap-1 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:px-8 lg:px-6">
        {children}
      </div>
    </fieldset>
  );
}

function Empty({
  query,
  category,
  show,
  onClear,
}: {
  query: string;
  category: string;
  show: Show;
  onClear: () => void;
}) {
  const where = category ? ` in ${category}` : "";
  return (
    <div className="px-5 pt-4 sm:px-8">
      <p className="font-semibold">
        {query
          ? `No products${where} match “${query}”.`
          : show === "attention"
            ? `Nothing${where} needs attention.`
            : `No products${where}.`}
      </p>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        {query
          ? "Search looks at product names and SKUs."
          : show === "attention"
            ? "Every product here has enough stock, counting what's on order, to outlast its supplier's lead time."
            : "Products are added by an admin."}
      </p>
      {query ? (
        <button
          type="button"
          onClick={onClear}
          className="-mx-1 mt-2 min-h-11 px-1 text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
        >
          Clear search
        </button>
      ) : null}
    </div>
  );
}
