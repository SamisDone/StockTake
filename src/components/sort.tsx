"use client";

import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Click-to-sort for a list's numeric columns. The sort is view state, so it lives in
 * the hash beside the filters (`sort=total-desc`); a table with no sort keeps its own
 * order (newest first, or whatever the page decided matters most).
 */
export type SortDir = "asc" | "desc";
export type Sort<K extends string> = { key: K; dir: SortDir } | null;

export function parseSort<K extends string>(value: string | null, keys: readonly K[]): Sort<K> {
  const [key, dir] = (value ?? "").split("-");
  return keys.includes(key as K) && (dir === "asc" || dir === "desc") ? { key: key as K, dir } : null;
}

export const sortParam = <K extends string>(sort: Sort<K>) => (sort ? `${sort.key}-${sort.dir}` : "");

/** Largest first, then smallest first, then back to the list's own order. */
export function nextSort<K extends string>(sort: Sort<K>, key: K): Sort<K> {
  if (sort?.key !== key) return { key, dir: "desc" };
  return sort.dir === "desc" ? { key, dir: "asc" } : null;
}

/** A stable sort by one number per row; rows without one (null) go last either way. */
export function sortRows<T, K extends string>(rows: T[], sort: Sort<K>, value: (row: T, key: K) => number | null) {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: value(row, sort.key) }))
    .sort((a, b) =>
      a.v === b.v ? a.index - b.index : a.v === null ? 1 : b.v === null ? -1 : (a.v - b.v) * sign || a.index - b.index,
    )
    .map((x) => x.row);
}

/**
 * A column heading that sorts its column. The arrow points the way the figures run
 * down the column and turns over (never swaps) when the order reverses; on the other
 * sortable headings it shows faintly on hover, so the click is discoverable without
 * printing arrows over every column.
 */
export function SortTh<K extends string>({
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
  children,
}: {
  sortKey: K;
  sort: Sort<K>;
  onSort: (sort: Sort<K>) => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const current = sort?.key === sortKey ? sort.dir : null;
  return (
    <th
      scope="col"
      aria-sort={current === "asc" ? "ascending" : current === "desc" ? "descending" : undefined}
      className={`field-name pt-1 pr-4 pb-2 first:pl-8 last:pr-8 ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey))}
        className={`group -my-1.5 inline-flex min-h-8 items-center gap-1 py-1.5 transition-colors duration-150 hover:text-ink focus-visible:text-ink ${align === "right" ? "flex-row-reverse" : ""} ${current ? "text-ink" : ""}`}
      >
        {children}
        <ArrowDown
          aria-hidden
          size={13}
          strokeWidth={2.5}
          className={`shrink-0 transition-[rotate,opacity] duration-150 ease-out ${current === "asc" ? "rotate-180" : ""} ${current ? "opacity-100" : "opacity-0 group-hover:opacity-50 group-focus-visible:opacity-50"}`}
        />
      </button>
    </th>
  );
}
