"use client";

import { ClipboardList, Ellipsis, LayoutGrid, Package, Search, SquarePen, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type ReactNode, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { onOpenSurface, openSurface } from "@/components/surfaces";
import { type NavLabels, SHELL_COPY } from "./copy";
import { SECTIONS, useSection } from "./nav";
import type { Language } from "@/lib/i18n";

/** The tabs a stockroom uses most; everything else is under More. */
const TABS = ["/dashboard", "/products"] as const;
const TABS_AFTER = ["/orders"] as const;
const ICONS: Partial<Record<keyof NavLabels, ReactNode>> = {
  "/dashboard": <LayoutGrid aria-hidden size={22} strokeWidth={2.25} />,
  "/products": <Package aria-hidden size={22} strokeWidth={2.25} />,
  "/orders": <ClipboardList aria-hidden size={22} strokeWidth={2.25} />,
};
const UNDER_MORE = SECTIONS.filter((s) => !(TABS as readonly string[]).includes(s) && s !== "/orders");

/**
 * On a phone, the sections live along the foot of the screen, under the thumb: the two
 * a stockroom opens most, Record in the middle (reverse print, the one thing always
 * there), Orders, and More for the rest, the language, the currency and signing out.
 * The current tab is printed in ink with a rule along its top edge.
 */
export function TabBar({ language }: { language: Language }) {
  const t = SHELL_COPY[language];
  return (
    <nav
      aria-label={t.sections}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-label pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Suspense fallback={<Tabs language={language} section={null} />}>
        <CurrentTabs language={language} />
      </Suspense>
    </nav>
  );
}

function CurrentTabs({ language }: { language: Language }) {
  return <Tabs language={language} section={useSection()} />;
}

function Tabs({ language, section }: { language: Language; section: string | null }) {
  const t = SHELL_COPY[language];
  const underMore = section !== null && (UNDER_MORE as string[]).includes(section);
  return (
    <ul className="grid h-16 grid-cols-5">
      {TABS.map((href) => (
        <Tab key={href} href={href} label={t.nav[href]} current={section === href} />
      ))}
      <li className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => openSurface("record")}
          className="group flex h-12 flex-col items-center justify-center rounded-control bg-ink px-4 text-label"
        >
          <span className="flex flex-col items-center transition-transform duration-150 ease-out group-active:scale-[0.96]">
            <SquarePen aria-hidden size={20} strokeWidth={2.25} />
            <span className="tab-name">{t.record}</span>
          </span>
        </button>
      </li>
      {TABS_AFTER.map((href) => (
        <Tab key={href} href={href} label={t.nav[href]} current={section === href} />
      ))}
      <li className="flex">
        <button
          type="button"
          onClick={() => openSurface("more")}
          className={`press-quiet relative flex flex-1 flex-col items-center justify-center gap-0.5 ${underMore ? "text-ink" : "text-ink-2"}`}
        >
          {underMore ? <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 bg-ink" /> : null}
          <Ellipsis aria-hidden size={22} strokeWidth={2.25} />
          <span className="tab-name">{t.more}</span>
        </button>
      </li>
    </ul>
  );
}

function Tab({ href, label, current }: { href: Route; label: string; current: boolean }) {
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`press-quiet relative flex flex-1 flex-col items-center justify-center gap-0.5 ${current ? "text-ink" : "text-ink-2"}`}
      >
        {current ? <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 bg-ink" /> : null}
        {ICONS[href as keyof NavLabels]}
        <span className="tab-name">{label}</span>
      </Link>
    </li>
  );
}

/**
 * Everything the tab bar leaves out: the other sections, then who's signed in with the
 * language, the currency and the way out (`children`, printed by the server). It rises
 * from the foot like the record sheet and closes when a section is chosen.
 */
export function MoreSheet({ language, children }: { language: Language; children: ReactNode }) {
  const t = SHELL_COPY[language];
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => onOpenSurface((surface) => setOpen(surface === "more")), []);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  // Leaving for a wider screen with the sheet open: it has nothing to say there.
  useEffect(() => {
    const wide = matchMedia("(min-width: 64rem)");
    const close = () => wide.matches && setOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="more-title"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      className="record-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/25 lg:hidden"
    >
      {open ? (
        <div className="sheet max-h-[85dvh] overflow-y-auto overscroll-contain rounded-b-none pb-[env(safe-area-inset-bottom)]">
          <header className="flex items-center justify-between gap-4 border-b-2 border-ink px-5 py-3">
            <h2 id="more-title" className="text-lg font-bold">
              {t.more}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="press-quiet -mr-2 flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-liner hover:text-ink"
            >
              <X aria-hidden size={20} strokeWidth={2.25} />
              <span className="sr-only">{t.sheet.close}</span>
            </button>
          </header>
          {/* A phone has no Ctrl+K: finding anything starts here. */}
          <div className="px-5 pt-4 pb-2">
            <button
              type="button"
              onClick={() => openSurface("palette")}
              className="press-quiet flex min-h-12 w-full items-center gap-2.5 rounded-control bg-liner px-3.5 text-left text-ink-2"
            >
              <Search aria-hidden size={18} strokeWidth={2.25} />
              <span className="sr-only">{t.find}: </span>
              <span className="min-w-0 truncate">{t.palette.search}</span>
            </button>
          </div>
          <nav aria-label={t.sections}>
            <ul className="border-b-2 border-ink pb-1">
              {UNDER_MORE.map((href) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center px-5 font-semibold active:bg-liner"
                  >
                    {t.nav[href]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-5 pt-3 pb-5">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
