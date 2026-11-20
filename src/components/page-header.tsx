import type { ReactNode } from "react";

/** The label's header zone: the page title printed large, closed by a 2px rule. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
      <h1 className="print-display text-4xl text-balance sm:text-5xl">{title}</h1>
      {actions}
    </header>
  );
}
