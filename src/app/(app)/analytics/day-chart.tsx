"use client";

import { type KeyboardEvent, type PointerEvent, useState } from "react";
import type { Formats } from "@/lib/format";

/**
 * The axis top: the smallest clean step × a power of ten at or above `value`. Each step
 * halves to a clean middle tick too (1,500 → 750), and they're close enough that the
 * tallest mark fills most of the plot.
 */
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value)!;
  return step * power;
}

/**
 * Picking one day of a plot: pointing at it (or scrubbing it with a finger) picks the
 * nearest day, and so do the arrow keys once it has focus. Escape, blur and a mouse
 * leaving put it back to nothing picked.
 */
export function useDayPicker(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const last = count - 1;

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - box.left) / box.width) * count);
    setActive(Math.min(Math.max(index, 0), last));
  };

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, (from: number) => number> = {
      ArrowLeft: (from) => Math.max(from - 1, 0),
      ArrowRight: (from) => Math.min(from + 1, last),
      Home: () => 0,
      End: () => last,
    };
    if (event.key === "Escape") return setActive(null);
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((from) => move(from ?? last + 1));
  };

  return {
    active,
    last,
    plot: {
      role: "slider",
      tabIndex: 0,
      "aria-valuemin": 1,
      "aria-valuemax": count,
      "aria-valuenow": (active ?? last) + 1,
      onPointerMove: pick,
      onPointerDown: pick,
      onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse") setActive(null);
      },
      onKeyDown: step,
      onBlur: () => setActive(null),
    } as const,
  };
}

/** The value axis: three clean ticks, which the plot's gridlines line up with. */
export function ValueAxis({ top, label }: { top: number; label: (value: number) => string }) {
  return (
    <div aria-hidden className="tabular relative h-44 text-right text-xs text-ink-3">
      {[1, 0.5, 0].map((at) => (
        <span
          key={at}
          className="block translate-y-1/2 leading-none"
          style={{ position: "absolute", right: 0, bottom: `${at * 100}%` }}
        >
          {label(top * at)}
        </span>
      ))}
      {/* Holds the column's width at its widest label. */}
      <span className="invisible block leading-none">{label(top)}</span>
    </div>
  );
}

/** The plot's gridlines at the top and middle ticks. */
export function Gridlines() {
  return (
    <>
      <div aria-hidden className="absolute inset-x-0 top-0 border-t border-hairline" />
      <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-hairline" />
    </>
  );
}

/** The day axis: the first day, the middle one under its mark, and today. */
export function DayAxis({ days, f, today }: { days: Date[]; f: Formats; today: string }) {
  const middle = Math.floor((days.length - 1) / 2);
  return (
    <>
      <div aria-hidden />
      <div aria-hidden className="relative mt-2 h-4 text-xs text-ink-3">
        <span className="absolute left-0">{f.date(days[0])}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${((middle + 0.5) / days.length) * 100}%` }}>
          {f.date(days[middle])}
        </span>
        <span className="absolute right-0">{today}</span>
      </div>
    </>
  );
}

/** The plot's frame: the value axis beside it, the day axis under it. */
export const PLOT_GRID = "mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3";

/** The plot itself: crosshair, scrubbing doesn't scroll sideways, a baseline in ink. */
export const PLOT = "relative h-44 cursor-crosshair touch-pan-y border-b border-ink select-none";
