"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog, which also saves the page as a PDF. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
    >
      <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
        <Printer aria-hidden size={18} strokeWidth={2.25} />
        {label}
      </span>
    </button>
  );
}
