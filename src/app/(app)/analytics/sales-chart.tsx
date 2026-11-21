"use client";

import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { ANALYTICS_COPY } from "./copy";
import { DayAxis, Gridlines, PLOT, PLOT_GRID, ValueAxis, niceMax, useDayPicker } from "./day-chart";

export type ChartDay = { day: Date; units: number; valueCents: number };

/**
 * Net sales a day as columns on one baseline, the last being today so far. The readout
 * above names the day picked; with nothing picked it reads the average of the full days.
 * It never animates: it's read many times a visit.
 */
export function SalesChart({ days, money, language }: { days: ChartDay[]; money: MoneyPrefs; language: Language }) {
  const m = moneyFormat(money, language);
  const f = formats(language);
  const t = ANALYTICS_COPY[language].chart;
  const units = (n: number) => t.units(n, f.count(n));
  const { active, last, plot } = useDayPicker(days.length);
  const full = days.slice(0, last);
  const average = {
    valueCents: full.reduce((sum, d) => sum + d.valueCents, 0) / Math.max(full.length, 1),
    units: full.reduce((sum, d) => sum + d.units, 0) / Math.max(full.length, 1),
  };
  // The top is a clean figure in the currency it reads in, so the ticks are too.
  const peak = Math.max(...days.map((d) => d.valueCents), average.valueCents);
  const top = (niceMax((peak / 100) * m.perDollar) / m.perDollar) * 100;
  const height = (cents: number) => `${(Math.max(cents, 0) / top) * 100}%`;

  const day = active === null ? null : days[active];
  const name = day === null ? t.average : active === last ? t.todaySoFar : f.day(day.day);
  const value = day?.valueCents ?? average.valueCents;
  const sold = units(day === null ? Math.round(average.units) : day.units);

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

      <div className={PLOT_GRID}>
        <ValueAxis top={top} label={m.axis} />
        <div {...plot} aria-label={t.label} aria-valuetext={`${name}: ${m.whole(value)}, ${sold}`} className={PLOT}>
          <Gridlines />
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
        <DayAxis days={days.map((d) => d.day)} f={f} today={t.today} />
      </div>
    </div>
  );
}
