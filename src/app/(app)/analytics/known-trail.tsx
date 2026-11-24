"use client";

import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { TallyFigure } from "@/components/stock";
import { TrailMorph } from "@/components/trail-morph";
import { StockChart } from "./stock-chart";
import type { StockPoint } from "./stock-plot";

/** What the dashboard's stock figure showed as it was opened. */
type Known = { days: StockPoint[]; openingCents: number; money: MoneyPrefs; language: Language; at: number };

let known: Known | null = null;

/** Long enough for the navigation the figure started; a figure opened earlier is stale. */
const FRESH_MS = 10_000;

/** What the figure showed, if it was opened just now and in this language. */
function freshFor(language: Language) {
  // Read when the placeholder renders, which is the navigation itself.
  const now = Date.now();
  return known !== null && known.language === language && now - known.at < FRESH_MS ? known : null;
}

/** Called as the dashboard's stock figure is followed. */
export function rememberTrail(trail: Omit<Known, "at">) {
  known = { ...trail, at: Date.now() };
}

/**
 * The stock chart's place in the analytics placeholder. Opened from the dashboard's stock
 * figure, it prints the chart from what the figure showed (the same 28 days), so the
 * figure has a chart to grow into while the report loads; the report's own chart then
 * takes its place, drawn the same. Otherwise, the bars.
 */
export function KnownStockChart({ language, bars }: { language: Language; bars: ReactNode }) {
  const known = freshFor(language);
  if (!known) return bars;
  return (
    <StockChart days={known.days} openingCents={known.openingCents} money={known.money} language={language} morph />
  );
}

/**
 * The stock-at-cost tally's figure in the analytics placeholder: the dashboard figure's
 * own value, for it to land on, when that's where the page was opened from.
 */
export function KnownStockFigure({ language, bar }: { language: Language; bar: ReactNode }) {
  const known = freshFor(language);
  if (!known) return bar;
  const text = moneyFormat(known.money, language).whole(known.days.at(-1)!.costCents);
  return (
    <TallyFigure as="p" text={text}>
      <StockFigureMorph>{text}</StockFigureMorph>
    </TallyFigure>
  );
}

/** The figure's name on both pages: the dashboard's stock tally, and analytics' over the same 28 days. */
export function StockFigureMorph({ children }: { children: ReactNode }) {
  return (
    <TrailMorph part="value">
      <span className="inline-block">{children}</span>
    </TrailMorph>
  );
}
