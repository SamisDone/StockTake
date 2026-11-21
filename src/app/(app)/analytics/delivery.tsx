import type { CSSProperties } from "react";
import type { Analytics, SupplierDelivery } from "@/domain/analytics";
import { NAV_FORWARD } from "@/components/transitions";
import type { Formats } from "@/lib/format";
import type { AnalyticsCopy } from "./copy";
import { Key, Zone } from "./zone";
import { IntentLink } from "@/components/intent-link";

const WEEK = 7;

/** Where the days axis ends: in whole weeks, past the slowest delivery and the longest quote. */
function axisEnd(suppliers: SupplierDelivery[]) {
  const longest = Math.max(...suppliers.flatMap((s) => [s.leadTimeDays, ...s.deliveries.map((d) => d.days)]));
  return Math.max(1, Math.ceil((longest + 1) / WEEK)) * WEEK;
}

/** One delivery's mark: filled if it arrived by its due day, hollow if after. */
function Dot({ late, className = "", style }: { late: boolean; className?: string; style?: CSSProperties }) {
  return <span style={style} className={`block size-2 rounded-full ${late ? "fill-hollow" : "bg-ink"} ${className}`} />;
}

/**
 * Every order that arrived in the period, one mark each, placed on a shared axis by the
 * days it took; orders that took the same days stack. Each supplier's quoted lead time is
 * ruled across their row, so a mark past the rule took longer than they say. Hollow marks
 * arrived after their due day (the date the supplier gave, else the lead time).
 */
export function Delivery({
  analytics,
  f,
  t,
  className,
}: {
  analytics: Analytics;
  f: Formats;
  t: AnalyticsCopy;
  className?: string;
}) {
  const suppliers = analytics.deliveries;
  if (suppliers.length === 0) {
    return (
      <Zone id="delivery" title={t.delivery} note={t.deliveryNote} className={className}>
        <p className="mt-4 px-5 font-semibold sm:px-8">{t.deliveryEmpty}</p>
      </Zone>
    );
  }
  const end = axisEnd(suppliers);
  const x = (days: number) => `${(days / end) * 100}%`;

  return (
    <Zone id="delivery" title={t.delivery} note={t.deliveryNote} className={className}>
      <div className="mt-4 px-5 sm:px-8">
        <Key
          items={[
            { swatch: <Dot late={false} />, name: t.onTime },
            { swatch: <Dot late />, name: t.late },
            { swatch: <span className="block h-3.5 border-l border-ink-3" />, name: t.quoted },
          ]}
        />
      </div>
      <ul className="mt-3 border-t border-ink">
        {suppliers.map((s) => {
          // Orders that took the same days stack upward, oldest at the bottom.
          const stacks = new Map<number, number>();
          const placed = s.deliveries.map((d) => {
            const level = stacks.get(d.days) ?? 0;
            stacks.set(d.days, level + 1);
            return { ...d, level };
          });
          const tallest = Math.max(...stacks.values());
          const fastest = Math.min(...s.deliveries.map((d) => d.days));
          const slowest = Math.max(...s.deliveries.map((d) => d.days));
          const took = fastest === slowest ? f.days(fastest) : `${f.count(fastest)}–${f.days(slowest)}`;
          const record = t.record(f.count(s.onTime), f.count(s.deliveries.length));
          return (
            <li key={s.id} className="border-b border-hairline px-5 py-3 last:border-b-0 sm:px-8">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0">
                  <IntentLink
                    href={`/suppliers/${s.id}`}
                    transitionTypes={NAV_FORWARD}
                    className="-my-2.5 mr-3 inline-block py-2.5 font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                  >
                    {s.name}
                  </IntentLink>
                  <span className="text-sm whitespace-nowrap text-ink-3">{t.quotes(f.days(s.leadTimeDays))}</span>
                </p>
                <p className={`shrink-0 text-sm ${s.onTime < s.deliveries.length ? "font-semibold" : ""}`}>{record}</p>
              </div>
              <div
                role="img"
                aria-label={t.deliveryLabel(s.name, took, record)}
                className="relative mt-1"
                // Room for the stack, and for the lead-time rule to stand clear above it.
                style={{ height: `${tallest * 10 + 12}px` }}
              >
                {/* The quoted lead time, ruled across the row's full height; marks sit on it with a gap. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 border-l border-ink-3"
                  style={{ left: x(s.leadTimeDays) }}
                />
                {placed.map((d) => (
                  <Dot
                    key={d.id}
                    late={!d.onTime}
                    className="absolute -translate-x-1/2 ring-2 ring-label"
                    // Pixel offsets keep stacked marks 2px apart whatever the row's width.
                    style={{ left: x(d.days), bottom: `${d.level * 10 + 1}px` }}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {/* The shared days axis, a tick a week, under the last row. */}
      <div aria-hidden className="relative mx-5 mt-0 h-6 border-t border-ink text-xs text-ink-3 sm:mx-8">
        {Array.from({ length: end / WEEK + 1 }, (_, i) => i * WEEK).map((at) => (
          <span
            key={at}
            className={`tabular absolute top-2 leading-none ${at === 0 ? "left-0" : at === end ? "right-0" : "-translate-x-1/2"}`}
            style={at === 0 || at === end ? undefined : { left: x(at) }}
          >
            {at === end ? f.days(at) : f.count(at)}
          </span>
        ))}
      </div>
    </Zone>
  );
}
