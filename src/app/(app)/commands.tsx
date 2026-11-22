"use client";

import { Search, SquarePen } from "lucide-react";
import { useEffect, useState } from "react";
import { openSurface } from "@/components/surfaces";
import type { Language } from "@/lib/i18n";
import { SHELL_COPY } from "./copy";
import { Key } from "./palette";

/**
 * The rail's two ways in: Record, the stockroom's main act, reverse-printed at the top,
 * and Find, the palette. Each shows its key, so the keyboard is learned by looking.
 */
export function RailCommands({ language }: { language: Language }) {
  const t = SHELL_COPY[language];
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => openSurface("record")}
        className="group flex min-h-11 items-center gap-2.5 rounded-control bg-ink px-3 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
      >
        <span className="flex flex-1 items-center gap-2.5 transition-transform duration-150 ease-out group-active:scale-[0.96]">
          <SquarePen aria-hidden size={18} strokeWidth={2.25} />
          {t.record}
        </span>
        <kbd
          aria-hidden
          className="rounded-mark border border-label/40 px-1.5 font-sans text-xs font-semibold text-label/80"
        >
          {t.recordKey}
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => openSurface("palette")}
        className="press-quiet flex min-h-11 items-center gap-2.5 rounded-control px-3 font-semibold text-ink-2 hover:bg-liner-deep hover:text-ink"
      >
        <Search aria-hidden size={18} strokeWidth={2.25} />
        <span className="flex-1 text-left">{t.find}</span>
        <span aria-hidden>
          <Key>
            <PaletteKey />
          </Key>
        </span>
      </button>
    </div>
  );
}

/** "Ctrl K", or "⌘K" on a Mac once the page knows it's on one. */
function PaletteKey() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the platform is only known in the browser
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return mac ? "⌘K" : "Ctrl K";
}

/**
 * On a phone, Record sits at the foot of the screen under the thumb, above the page: a
 * real layer, so it carries the sheet's shadow. The bottom tab bar will take it over.
 */
export function PhoneRecord({ language }: { language: Language }) {
  return (
    <button
      type="button"
      onClick={() => openSurface("record")}
      className="group fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-control bg-ink px-5 font-semibold text-label shadow-label lg:hidden"
    >
      <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
        <SquarePen aria-hidden size={20} strokeWidth={2.25} />
        {SHELL_COPY[language].record}
      </span>
    </button>
  );
}
