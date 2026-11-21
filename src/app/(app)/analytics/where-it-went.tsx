import type { Analytics } from "@/domain/analytics";
import { Th } from "@/components/stock";
import type { Formats } from "@/lib/format";
import type { MoneyFormat } from "@/lib/money";
import type { AnalyticsCopy } from "./copy";
import { Zone } from "./zone";

type Part = Analytics["whereItWent"]["parts"][number]["part"];

/** Each part's fill, in the one ink: see the chart fills in globals.css. */
export const PART_FILL: Record<Part, string> = {
  sold: "bg-ink",
  writtenOff: "fill-hatch",
  short: "fill-hatch-back",
  onHand: "bg-ink-3/45",
};

/**
 * Everything that was on the shelves in the period, as one bar split by what became of
 * it, each part's width its share at cost. A part too small to see still prints a
 * sliver; the table under the bar carries every figure, so it is also the bar's key.
 */
export function WhereItWent({
  analytics,
  m,
  f,
  t,
  className,
}: {
  analytics: Analytics;
  m: MoneyFormat;
  f: Formats;
  t: AnalyticsCopy;
  className?: string;
}) {
  const { whole, parts } = analytics.whereItWent;
  const share = (cents: number) => (whole.costCents > 0 ? cents / whole.costCents : 0);
  const percent = (cents: number) => {
    const value = share(cents) * 100;
    // A sliver reads "<1%", not a misleading 0%.
    return cents > 0 && value < 1 ? `<${f.count(1)}%` : `${f.count(Math.round(value))}%`;
  };

  return (
    <Zone id="went" title={t.went} note={t.wentNote} className={className}>
      <div className="mt-5 px-5 sm:px-8">
        <p className="text-sm font-semibold">{t.wentWhole(m.whole(whole.costCents), f.count(whole.units))}</p>
        <div aria-hidden className="mt-2 flex h-8 gap-0.5">
          {whole.costCents > 0 ? (
            parts
              .filter((p) => p.amount.costCents > 0)
              .map((p) => (
                <div
                  key={p.part}
                  className={`min-w-0.5 rounded-mark ${PART_FILL[p.part]}`}
                  style={{ flex: `${share(p.amount.costCents)} 1 0` }}
                />
              ))
          ) : (
            <div className="flex-1 rounded-mark bg-liner" />
          )}
        </div>
      </div>
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ink">
            <Th>{t.wentColumn}</Th>
            <Th align="right">{t.atCost}</Th>
            <Th align="right">{t.units}</Th>
            <Th align="right">{t.shareColumn}</Th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.part} className="border-b border-hairline last:border-b-0">
              <th scope="row" className="py-2.5 pr-4 pl-5 font-normal sm:pl-8">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={`size-3.5 shrink-0 rounded-mark ${PART_FILL[p.part]}`} />
                  {t.wentParts[p.part]}
                </span>
              </th>
              <td className="tabular py-2.5 pr-4 text-right">{m.whole(p.amount.costCents)}</td>
              <td className="tabular py-2.5 pr-4 text-right text-ink-2">{f.count(p.amount.units)}</td>
              <td className="tabular py-2.5 pr-5 text-right font-semibold sm:pr-8">{percent(p.amount.costCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Zone>
  );
}
