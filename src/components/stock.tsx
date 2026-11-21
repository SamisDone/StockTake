import type { ReactNode } from "react";
import type { StockStatus } from "@/domain/forecast";
import { formatCount, formatDays } from "@/lib/format";

/**
 * The printed parts every stock screen shares: tallies, status marks, the cover bar,
 * and column headings. Plain components, usable from server and client code alike.
 */

/** Cover bars share one scale, so any two bars on any screen compare at a glance. */
export const COVER_SCALE_DAYS = 45;

/**
 * Four tallies: two by two on a phone, where the third starts a row and so takes a top
 * rule, not a side one; one row from `sm`. Shared with placeholders so they never jump.
 */
export const FOUR_TALLIES =
  "grid-cols-2 sm:grid-cols-4 max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t";

/** One field of a label's tally zone: its name small, the value printed large. */
export function Tally({ name, value, children }: { name: string; value: number | string; children?: ReactNode }) {
  return (
    <div className="min-w-0 border-l border-ink px-5 pt-3 pb-4 first:border-l-0 sm:px-8">
      <dt className="field-name">{name}</dt>
      <dd className="print-display mt-1 text-[1.75rem] sm:text-5xl">
        {typeof value === "number" ? formatCount(value) : value}
      </dd>
      {children}
    </div>
  );
}

/** Out is reverse-printed; reorder is printed on yellow attention stock. Healthy stock carries no mark. */
export function StatusMark({ status }: { status: StockStatus }) {
  if (status === "ok") return null;
  return status === "out" ? (
    <span className="shrink-0 rounded-mark bg-ink px-1.5 py-px text-xs font-bold text-label">Out</span>
  ) : (
    <span className="shrink-0 rounded-mark bg-stock px-1.5 py-px text-xs font-bold text-ink">Reorder</span>
  );
}

/** What a cover bar says in words, so an empty bar is never left to interpretation. */
export function coverLabel(daysOfCover: number | null) {
  return daysOfCover === null ? "No sales in 28 days" : daysOfCover === 0 ? "None left" : formatDays(daysOfCover);
}

/** The bar alone: its length is the exact cover on the shared scale; the tick is the lead time. */
export function CoverTrack({ daysOfCover, leadTimeDays }: { daysOfCover: number | null; leadTimeDays: number }) {
  const position = (days: number) => `${(Math.min(days, COVER_SCALE_DAYS) / COVER_SCALE_DAYS) * 100}%`;
  return (
    <div aria-hidden className="relative h-1.5 bg-liner">
      {daysOfCover ? <div className="h-full bg-ink" style={{ width: position(daysOfCover) }} /> : null}
      <div className="absolute -top-1 h-3.5 w-0.5 bg-ink" style={{ left: position(leadTimeDays) }} />
    </div>
  );
}

/** Cover in words above its bar, with the lead time the tick marks. */
export function CoverBar({ daysOfCover, leadTimeDays }: { daysOfCover: number | null; leadTimeDays: number }) {
  return (
    <div>
      <p className="text-sm">
        <span className="font-semibold whitespace-nowrap">{coverLabel(daysOfCover)}</span>
        {/* On a phone the lead time takes its own line, so neither part breaks. */}
        <span className="whitespace-nowrap text-ink-3 max-md:block">
          <span className="max-md:hidden"> · </span>lead {formatDays(leadTimeDays)}
        </span>
      </p>
      <div className="mt-2">
        <CoverTrack daysOfCover={daysOfCover} leadTimeDays={leadTimeDays} />
      </div>
    </div>
  );
}

/** A field name shown only when a table row stacks into a label, where there are no column headers. */
export function MobileName({ children }: { children: ReactNode }) {
  return <span className="field-name mb-0.5 block text-left md:hidden">{children}</span>;
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`field-name pt-1 pr-4 pb-2 first:pl-8 last:pr-8 ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

/**
 * Field names of a tally zone over unprinted blocks, holding its space while data loads.
 * A zone that isn't one row at every width passes its own column classes as `className`.
 */
export function TallyPlaceholder({
  names,
  className,
  notes = false,
}: {
  names: string[];
  className?: string;
  /** The tallies print a line of notes under their figures, so the blocks hold that too. */
  notes?: boolean;
}) {
  return (
    <div
      className={`grid border-b-2 border-ink ${className ?? ""}`}
      style={className ? undefined : { gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}
    >
      {names.map((name) => (
        <div key={name} className="border-l border-ink px-5 pt-3 pb-4 first:border-l-0 sm:px-8">
          <p className="field-name">{name}</p>
          {/* The figure: 1.75rem (3rem from sm) at 0.95 leading, under a 4px gap. */}
          <div className="mt-1.5 h-7 w-14 bg-liner sm:h-11" />
          {notes ? <div className="mt-1 h-5 w-24 bg-liner/70" /> : null}
        </div>
      ))}
    </div>
  );
}
