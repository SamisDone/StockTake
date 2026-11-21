"use client";

import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { ANALYTICS_COPY } from "./copy";
import { DayAxis, Gridlines, PLOT, PLOT_GRID, ValueAxis, niceMax, useDayPicker } from "./day-chart";

export type StockPoint = { day: Date; costCents: number };

/**
 * Stock at cost at the end of each day, as one line from zero up, the last point being
 * now. The readout names the day picked and what that day's movements changed; with
 * nothing picked it reads now, and the change since the period opened.
 */
export function StockChart({
  days,
  openingCents,
  money,
  language,
}: {
  days: StockPoint[];
  openingCents: number;
  money: MoneyPrefs;
  language: Language;
}) {
  const m = moneyFormat(money, language);
  const f = formats(language);
  const t = ANALYTICS_COPY[language].stockChart;
  const { active, last, plot } = useDayPicker(days.length);
  const peak = Math.max(...days.map((d) => d.costCents), openingCents);
  const top = (niceMax((peak / 100) * m.perDollar) / m.perDollar) * 100;
  // In the plot's own units: one per day across, 100 up.
  const y = (cents: number) => 100 - (Math.max(cents, 0) / top) * 100;
  const points = days.map((d, i) => `${i + 0.5},${y(d.costCents)}`).join(" ");

  const day = active === null ? null : days[active];
  const name = day === null || active === last ? t.now : f.day(day.day);
  const value = day?.costCents ?? days[last].costCents;
  const before = active === null ? openingCents : active === 0 ? openingCents : days[active - 1].costCents;
  const detail =
    active === null
      ? t.sincePeriod(m.change(value - before), f.date(days[0].day))
      : t.onTheDay(m.change(value - before));
  const at = active ?? last;

  return (
    <div>
      <div aria-live="polite">
        <p className="field-name">{name}</p>
        <p className="print-display mt-1 text-[1.75rem] sm:text-4xl">{m.whole(value)}</p>
        <p className="mt-1 text-sm text-ink-2">{detail}</p>
      </div>

      <div className={PLOT_GRID}>
        <ValueAxis top={top} label={m.axis} />
        <div {...plot} aria-label={t.label} aria-valuetext={`${name}: ${m.whole(value)}, ${detail}`} className={PLOT}>
          <Gridlines />
          <svg
            aria-hidden
            viewBox={`0 0 ${days.length} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <polygon points={`0.5,100 ${points} ${days.length - 0.5},100`} className="fill-liner" />
            <polyline
              points={points}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              strokeLinejoin="round"
              className="stroke-ink"
            />
          </svg>
          {/* The day read: a rule down to the baseline and a mark on the line, drawn round in HTML. */}
          <div
            aria-hidden
            className={`absolute inset-y-0 border-l border-ink-3 ${active === null ? "hidden" : ""}`}
            style={{ left: `${((at + 0.5) / days.length) * 100}%` }}
          />
          <div
            aria-hidden
            className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-ink ring-2 ring-label"
            style={{ left: `${((at + 0.5) / days.length) * 100}%`, bottom: `${100 - y(days[at].costCents)}%` }}
          />
        </div>
        <DayAxis days={days.map((d) => d.day)} f={f} today={t.now} />
      </div>
    </div>
  );
}
