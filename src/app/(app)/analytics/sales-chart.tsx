"use client";

import { type KeyboardEvent, type PointerEvent, useState } from "react";
import { formatCount, formatDate, formatDay } from "@/lib/format";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";

export type ChartDay = { day: Date; units: number; valueCents: number };

/**
 * The axis top: the smallest clean step × a power of ten at or above `value`. Each step
 * halves to a clean middle tick too (1,500 → 750), and they're close enough that the
 * tallest column fills most of the plot.
 */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value)!;
  return step * power;
}

const units = (n: number) => `${formatCount(n)} ${n === 1 ? "unit" : "units"}`;

/**
 * Net sales a day as columns on one baseline, the last being today so far. The readout
 * above names one day at a time: pointing at the plot (or scrubbing it with a finger)
 * picks the nearest day, and so do the arrow keys once it has focus. With nothing picked
 * it reads the average of the full days. It never animates: it's read many times a visit.
 */
export function SalesChart({ days, money }: { days: ChartDay[]; money: MoneyPrefs }) {
  const m = moneyFormat(money);
  const [active, setActive] = useState<number | null>(null);
  const last = days.length - 1;
  const full = days.slice(0, last);
  const average = {
    valueCents: full.reduce((sum, d) => sum + d.valueCents, 0) / Math.max(full.length, 1),
    units: full.reduce((sum, d) => sum + d.units, 0) / Math.max(full.length, 1),
  };
  // The top is a clean figure in the currency it reads in, so the ticks are too.
  const peak = Math.max(...days.map((d) => d.valueCents), average.valueCents);
  const top = (niceMax((peak / 100) * m.perDollar) / m.perDollar) * 100;
  const height = (cents: number) => `${(Math.max(cents, 0) / top) * 100}%`;

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - box.left) / box.width) * days.length);
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

  const day = active === null ? null : days[active];
  const name = day === null ? "Average full day" : active === last ? "Today so far" : formatDay(day.day);
  const value = day?.valueCents ?? average.valueCents;
  const sold = day === null ? `${formatCount(Math.round(average.units))} units` : units(day.units);
  const middle = Math.floor(last / 2);

  return (
    <div>
      <div aria-live="polite">
        <p className="field-name flex items-center gap-1.5">
          {/* The average's key: the rule drawn across the columns at its height. */}
          {day === null ? <span aria-hidden className="h-px w-3 bg-ink-3" /> : null}
          {name}
        </p>
        <p className="print-display mt-1 text-[1.75rem] sm:text-4xl">{m.whole(value)}</p>
        <p className="mt-1 text-sm text-ink-2">{sold}</p>
      </div>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        {/* The value axis: three clean ticks, the plot's gridlines line up with them. */}
        <div aria-hidden className="tabular relative h-44 text-right text-xs text-ink-3">
          {[1, 0.5, 0].map((at) => (
            <span
              key={at}
              className="block translate-y-1/2 leading-none"
              style={{ position: "absolute", right: 0, bottom: `${at * 100}%` }}
            >
              {m.axis(top * at)}
            </span>
          ))}
          {/* Holds the column's width at its widest label. */}
          <span className="invisible block leading-none">{m.axis(top)}</span>
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Sales by day. Use the arrow keys to read each day."
          aria-valuemin={1}
          aria-valuemax={days.length}
          aria-valuenow={(active ?? last) + 1}
          aria-valuetext={`${name}: ${m.whole(value)}, ${sold}`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setActive(null);
          }}
          onKeyDown={step}
          onBlur={() => setActive(null)}
          className="relative h-44 cursor-crosshair touch-pan-y border-b border-ink select-none"
        >
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-hairline" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-hairline" />
          {/* The average full day, ruled across the columns. */}
          {average.valueCents > 0 ? (
            <div
              aria-hidden
              className="absolute inset-x-0 z-10 border-t border-ink-3"
              style={{ bottom: height(average.valueCents) }}
            />
          ) : null}
          <div aria-hidden className="absolute inset-0 flex items-end">
            {days.map((d, i) => (
              <div key={d.day.getTime()} className="flex h-full flex-1 items-end justify-center px-px">
                <div
                  className={`w-full max-w-6 rounded-t-mark ${active !== null && active !== i ? "bg-ink/25" : "bg-ink"}`}
                  style={{ height: height(d.valueCents) }}
                />
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden />
        <div aria-hidden className="relative mt-2 h-4 text-xs text-ink-3">
          <span className="absolute left-0">{formatDate(days[0].day)}</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${((middle + 0.5) / days.length) * 100}%` }}>
            {formatDate(days[middle].day)}
          </span>
          <span className="absolute right-0">Today</span>
        </div>
      </div>
    </div>
  );
}
