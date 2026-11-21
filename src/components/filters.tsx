import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Filters that live in the query string, for pages with no intercepting route under them
 * (activity, analytics). A row of links printed like the lists' choices: the current one
 * is reverse print.
 */
export function FilterRow({
  legend,
  className = "",
  children,
}: {
  legend: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={legend} className={`min-w-0 pt-2.5 pb-2 ${className}`}>
      <p aria-hidden className="field-name px-5 sm:px-8">
        {legend}
      </p>
      {/* On a phone the choices scroll sideways rather than wrap. */}
      <div className="mt-1 flex gap-1 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:px-8 lg:px-6">
        {children}
      </div>
    </div>
  );
}

/** One choice: replaces the URL in place, so a run of filter changes is one history entry. */
export function FilterLink({ href, current, children }: { href: Route; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      prefetch={false}
      aria-current={current ? "true" : undefined}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-control px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 select-none pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current ${
        current ? "bg-ink text-label" : "text-ink-2 hover:bg-liner hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/** Placeholder blocks in the shape of a filter row's choices. */
export function FilterRowPlaceholder({
  legend,
  count,
  className = "",
}: {
  legend: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={`pt-2.5 pb-2 ${className}`}>
      <p className="field-name px-5 sm:px-8">{legend}</p>
      <div className="mt-1 flex gap-1 px-5 pb-0.5 sm:px-8 lg:px-6">
        {Array.from({ length: count }, (_, j) => (
          <div key={j} className="h-9 w-24 rounded-control bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
