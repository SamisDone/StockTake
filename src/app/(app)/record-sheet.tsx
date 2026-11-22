"use client";

import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cachedIndex, isTyping, loadIndex, modalOpen, onOpenSurface } from "@/components/surfaces";
import { rankMatch } from "@/lib/rank-match";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import type { FindIndex } from "@/server/find-actions";
import { RecordStock } from "./products/record-stock";
import { SHELL_COPY } from "./copy";

type Product = FindIndex["products"][number];

/**
 * Record stock from anywhere: the Record button or the R key opens it over whatever page
 * is showing. Find the product by name or SKU, then the same form a product's label has;
 * once the line is written the sheet closes and a toast confirms it, with Undo and a way
 * to the label. At a desk it appears at once (it's opened from the keyboard, often); on a
 * phone it rises from the foot of the screen, where the thumb that opened it is.
 */
export function RecordSheet({ language }: { language: Language }) {
  const t = SHELL_COPY[language].sheet;
  const f = formats(language);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<FindIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const show = () => {
      setChosen(null);
      setQuery("");
      setFailed(false);
      setIndex(cachedIndex());
      setOpen(true);
      loadIndex().then(setIndex, () => setFailed(cachedIndex() === null));
    };
    const offOpen = onOpenSurface((surface) => (surface === "record" ? show() : setOpen(false)));
    // The key, not the letter: R is R on a Bangla layout too.
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyR" || event.repeat || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target) || modalOpen()) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offOpen();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      // The dialog focuses its first control (Close); the search is where a person starts.
      node.querySelector<HTMLElement>("[cmdk-input]")?.focus();
    }
    if (!open && node.open) node.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="sheet-title"
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="record-sheet fixed m-0 max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/25 max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 sm:inset-x-0 sm:top-[10dvh] sm:mx-auto sm:w-[min(40rem,calc(100vw-2rem))]"
    >
      {open ? (
        <div className="sheet flex max-h-[85dvh] flex-col overflow-hidden max-sm:rounded-b-none">
          <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-5 pb-4 sm:px-8">
            <div className="min-w-0">
              <h2 id="sheet-title" className="text-lg font-bold">
                {t.title}
              </h2>
              <p className="mt-1 text-sm text-ink-2">{t.help}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="press-quiet -mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-liner hover:text-ink"
            >
              <X aria-hidden size={20} strokeWidth={2.25} />
              <span className="sr-only">{t.close}</span>
            </button>
          </header>

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {chosen ? (
              <>
                <div className="flex items-center justify-between gap-4 border-b border-ink px-5 py-3 sm:px-8">
                  <div className="min-w-0">
                    <p className="font-semibold">{chosen.name}</p>
                    <p className="text-sm text-ink-2">
                      <span className="font-mono text-xs">{chosen.sku}</span> · {t.onHand(f.count(chosen.onHand))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChosen(null)}
                    className="press-quiet min-h-11 shrink-0 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
                  >
                    {t.change}
                  </button>
                </div>
                <RecordStock
                  productId={chosen.id}
                  onHand={chosen.onHand}
                  headingLevel={3}
                  language={language}
                  idPrefix="sheet-"
                  labelledBy="sheet-title"
                  linkProduct
                  onRecorded={close}
                />
              </>
            ) : (
              <Command label={t.searchLabel} loop filter={rankMatch} className="pb-2">
                <div className="flex items-center gap-2 border-b border-ink px-5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] sm:px-8">
                  <Search aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-ink-3" />
                  <Command.Input
                    // Back from "Change", the search takes focus again.
                    ref={(input) => input?.focus()}
                    value={query}
                    onValueChange={setQuery}
                    placeholder={t.search}
                    className="h-14 min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-ink-3"
                  />
                </div>
                <Command.List className="px-2 pt-2 sm:px-5">
                  {index === null ? (
                    <Command.Loading>
                      <p className="px-3 py-3 text-sm text-ink-2">{failed ? t.failed : t.loading}</p>
                    </Command.Loading>
                  ) : (
                    <>
                      <Command.Empty className="px-3 py-3 text-sm text-ink-2">{t.noMatch(query)}</Command.Empty>
                      {index.products.map((product) => (
                        <Command.Item
                          key={product.id}
                          value={`product-${product.id}`}
                          keywords={[product.name, product.sku]}
                          onSelect={() => setChosen(product)}
                          className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-control px-3 py-2 data-[selected=true]:bg-liner"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold">{product.name}</span>
                            <span className="block font-mono text-xs text-ink-3">{product.sku}</span>
                          </span>
                          <span className="shrink-0 text-sm text-ink-2">{t.onHand(f.count(product.onHand))}</span>
                        </Command.Item>
                      ))}
                    </>
                  )}
                </Command.List>
              </Command>
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
