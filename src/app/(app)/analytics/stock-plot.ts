import { niceMax } from "@/lib/nice-max";

export type StockPoint = { day: Date; costCents: number };

/**
 * How a line of stock at cost is drawn, in the plot's own units: one per day across,
 * 100 up, from zero to a round top in the reader's currency. The analytics chart and the
 * dashboard's small line share it, so the one grows into the other exactly.
 */
export function stockPlot(days: StockPoint[], openingCents: number, perDollar: number) {
  const peak = Math.max(...days.map((d) => d.costCents), openingCents);
  const top = (niceMax((peak / 100) * perDollar) / perDollar) * 100;
  const y = (cents: number) => 100 - (Math.max(cents, 0) / top) * 100;
  const points = days.map((d, i) => `${i + 0.5},${y(d.costCents)}`).join(" ");
  return { top, y, points, area: `0.5,100 ${points} ${days.length - 0.5},100` };
}
