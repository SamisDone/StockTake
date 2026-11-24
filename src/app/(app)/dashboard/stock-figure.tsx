"use client";

import { stockPlot, type StockPoint } from "../analytics/stock-plot";
import { StockFigureMorph, rememberTrail } from "../analytics/known-trail";
import { IntentLink } from "@/components/intent-link";
import { Tally } from "@/components/stock";
import { TrailMorph } from "@/components/trail-morph";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";

/**
 * Stock at cost now, over the line it drew in the last 28 days. Opening it goes to
 * analytics, where the figure becomes the stock chart's readout and the line its plot:
 * the same days on the same scale, so the line grows without changing shape.
 */
export function StockFigure({
  days,
  openingCents,
  money,
  language,
  name,
  link,
}: {
  days: StockPoint[];
  openingCents: number;
  money: MoneyPrefs;
  language: Language;
  name: string;
  /** The link's words, naming where it goes. */
  link: string;
}) {
  const m = moneyFormat(money, language);
  const { y, points, area } = stockPlot(days, openingCents, m.perDollar);
  const last = days.length - 1;

  return (
    <Tally
      name={name}
      value={m.whole(days[last].costCents)}
      language={language}
      className="relative row-hit"
      figure={(text) => <StockFigureMorph>{text}</StockFigureMorph>}
    >
      <TrailMorph part="plot">
        <div aria-hidden className="relative mt-2 h-6 border-b border-ink">
          <svg
            viewBox={`0 0 ${days.length} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <polygon points={area} className="fill-liner" />
            <polyline
              points={points}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeLinejoin="round"
              className="stroke-ink"
            />
          </svg>
          <div
            className="absolute size-1.5 translate-x-1/2 translate-y-1/2 rounded-full bg-ink"
            style={{ right: `${(0.5 / days.length) * 100}%`, bottom: `${100 - y(days[last].costCents)}%` }}
          />
        </div>
      </TrailMorph>
      {/* The link's hit area covers the whole tally, figure and line included. */}
      <IntentLink
        href="/analytics"
        onNavigate={() => rememberTrail({ days, openingCents, money, language })}
        className="mt-1.5 inline-block text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 after:absolute after:inset-0 hover:decoration-ink focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
      >
        {link}
      </IntentLink>
    </Tally>
  );
}
