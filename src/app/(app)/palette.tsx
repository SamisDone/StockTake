"use client";

import { Command } from "cmdk";
import { ArrowRight, Languages, Plus, Search, SquarePen, Wallet } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { cachedIndex, loadIndex, onOpenSurface, openSurface } from "@/components/surfaces";
import { rankMatch } from "@/lib/rank-match";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import type { Currency } from "@/lib/money";
import type { FindIndex } from "@/server/find-actions";
import { setCurrency, setLanguage } from "@/server/preference-actions";
import { ORDERS_COPY } from "./orders/copy";
import { SHELL_COPY } from "./copy";

const PAGES = [
  "/dashboard",
  "/ask",
  "/products",
  "/sales",
  "/customers",
  "/orders",
  "/suppliers",
  "/analytics",
  "/activity",
  "/people",
] as const;

/**
 * The command palette: Ctrl+K (⌘K on a Mac) anywhere, or Find in the rail. One search
 * over every product, order, supplier and customer, the sections, and what can be done from here:
 * record stock, start an order, switch language or currency. It opens and closes at
 * once, with no animation: it's for people who use it many times a day. A product opens
 * in the drawer over the page; everything else goes to its page.
 */
export function Palette({ language, currency, isAdmin }: { language: Language; currency: Currency; isAdmin: boolean }) {
  const shell = SHELL_COPY[language];
  const t = shell.palette;
  const status = ORDERS_COPY[language].status;
  const f = formats(language);
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<FindIndex | null>(null);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const show = () => {
      setQuery("");
      setIndex(cachedIndex());
      setOpen(true);
      loadIndex().then(setIndex, () => {});
    };
    const offOpen = onOpenSurface((surface) => (surface === "palette" ? show() : setOpen(false)));
    // The key, not the letter, so it works on a Bangla layout; it also works while typing.
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyK" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (dialog.current?.open) setOpen(false);
      else openSurface("palette");
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

  const go = <T extends string>(href: Route<T>) => {
    setOpen(false);
    router.push(href, { scroll: false });
  };
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  const switchLanguage = () =>
    run(() =>
      startTransition(async () => {
        const formData = new FormData();
        formData.set("language", language === "en" ? "bn" : "en");
        await setLanguage(formData);
        router.refresh();
      }),
    );
  const switchCurrency = () =>
    run(() =>
      startTransition(async () => {
        const formData = new FormData();
        formData.set("currency", currency === "USD" ? "BDT" : "USD");
        await setCurrency(formData);
      }),
    );

  return (
    <dialog
      ref={dialog}
      aria-label={t.title}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      className="fixed inset-x-0 top-[10dvh] m-0 mx-auto max-h-none w-[min(40rem,calc(100vw-2rem))] max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/25"
    >
      {open ? (
        <Command label={t.title} loop filter={rankMatch} className="sheet flex max-h-[70dvh] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b-2 border-ink px-5 sm:px-6">
            <Search aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-ink-3" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t.search}
              className="h-14 min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-ink-3"
            />
          </div>
          <Command.List className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 sm:px-3">
            <Command.Empty className="px-3 py-4 text-sm text-ink-2">{t.noMatch(query)}</Command.Empty>

            <Group heading={t.groups.actions}>
              <Item
                value="record"
                keywords={[t.recordStock]}
                icon={<SquarePen />}
                onSelect={() => run(() => openSurface("record"))}
              >
                {t.recordStock}
                <Key>{shell.recordKey}</Key>
              </Item>
              <Item value="new-sale" keywords={[t.newSale]} icon={<Plus />} onSelect={() => go("/sales/new")}>
                {t.newSale}
              </Item>
              <Item value="new-order" keywords={[t.newOrder]} icon={<Plus />} onSelect={() => go("/orders/new")}>
                {t.newOrder}
              </Item>
              {isAdmin ? (
                <>
                  <Item
                    value="new-product"
                    keywords={[t.newProduct]}
                    icon={<Plus />}
                    onSelect={() => go("/products/new")}
                  >
                    {t.newProduct}
                  </Item>
                  <Item
                    value="new-supplier"
                    keywords={[t.newSupplier]}
                    icon={<Plus />}
                    onSelect={() => go("/suppliers/new")}
                  >
                    {t.newSupplier}
                  </Item>
                </>
              ) : null}
              <Item
                value="language"
                keywords={[t.switchLanguage, "language ভাষা bangla english"]}
                icon={<Languages />}
                onSelect={switchLanguage}
              >
                <span lang={language === "en" ? "bn" : "en"}>{t.switchLanguage}</span>
              </Item>
              <Item
                value="currency"
                keywords={[t.switchCurrency(currency === "BDT"), "currency মুদ্রা taka dollar"]}
                icon={<Wallet />}
                onSelect={switchCurrency}
              >
                {t.switchCurrency(currency === "BDT")}
              </Item>
            </Group>

            <Group heading={t.groups.pages}>
              {PAGES.map((page) => (
                <Item
                  key={page}
                  value={page}
                  keywords={[shell.nav[page], page.slice(1)]}
                  icon={<ArrowRight />}
                  onSelect={() => go(page)}
                >
                  {shell.nav[page]}
                </Item>
              ))}
            </Group>

            {index === null ? (
              <Command.Loading>
                <p className="px-3 py-3 text-sm text-ink-2">{t.loading}</p>
              </Command.Loading>
            ) : (
              <>
                <Group heading={t.groups.products}>
                  {index.products.map((p) => (
                    <Item
                      key={p.id}
                      value={`product-${p.id}`}
                      keywords={[p.name, p.sku]}
                      onSelect={() => go(`/products/${p.id}`)}
                      meta={t.onHand(f.count(p.onHand))}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{p.name}</span>
                        <span className="block font-mono text-xs font-normal text-ink-3">{p.sku}</span>
                      </span>
                    </Item>
                  ))}
                </Group>
                <Group heading={t.groups.orders}>
                  {index.orders.map((o) => (
                    <Item
                      key={o.id}
                      value={`order-${o.id}`}
                      keywords={[o.number, o.supplierName, status[o.status]]}
                      onSelect={() => go(`/orders/${o.id}`)}
                      meta={status[o.status]}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{o.supplierName}</span>
                        <span className="block font-mono text-xs font-normal text-ink-3">{o.number}</span>
                      </span>
                    </Item>
                  ))}
                </Group>
                <Group heading={t.groups.suppliers}>
                  {index.suppliers.map((s) => (
                    <Item
                      key={s.id}
                      value={`supplier-${s.id}`}
                      keywords={[s.name]}
                      onSelect={() => go(`/suppliers/${s.id}`)}
                    >
                      {s.name}
                    </Item>
                  ))}
                </Group>
                <Group heading={t.groups.customers}>
                  {index.customers.map((c) => (
                    <Item
                      key={c.id}
                      value={`customer-${c.id}`}
                      keywords={[c.name, ...(c.phone ? [c.phone] : [])]}
                      onSelect={() => go(`/customers/${c.id}`)}
                      meta={c.phone ?? undefined}
                    >
                      {c.name}
                    </Item>
                  ))}
                </Group>
              </>
            )}
          </Command.List>
        </Command>
      ) : null}
    </dialog>
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="pt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  keywords,
  icon,
  meta,
  onSelect,
  children,
}: {
  /** Unique per row: what cmdk keys the row by. */
  value: string;
  /** What the search matches against. */
  keywords: string[];
  icon?: ReactNode;
  meta?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 font-semibold data-[selected=true]:bg-liner [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:stroke-[2.25] [&>svg]:text-ink-2"
    >
      {icon}
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</span>
      {meta ? <span className="shrink-0 text-sm font-normal text-ink-2">{meta}</span> : null}
    </Command.Item>
  );
}

/** A key to press, printed as a small keycap. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="shrink-0 rounded-mark border border-ink-3/50 px-1.5 font-sans text-xs font-semibold text-ink-2">
      {children}
    </kbd>
  );
}
