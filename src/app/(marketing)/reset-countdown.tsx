"use client";

import { useSyncExternalStore } from "react";
import { dayFromNumber, dayNumber } from "@/lib/business-time";
import { localDigits, type Language } from "@/lib/i18n";
import { COPY } from "./copy";

/**
 * How long until the demo starts over: the next midnight on the business's clock
 * (Asia/Dhaka), counted down each second. The prerendered page (and the render that
 * hydrates it) holds the clock's place with an invisible one, so the server and the
 * first client render agree and nothing moves when it starts. The clock ends the line,
 * so its digits changing width (Bangla numerals aren't tabular) never push anything.
 */

// Re-read a few times a second; the snapshot only changes on the second, so the clock
// renders once per second and never drifts behind the wall clock.
function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 250);
  return () => clearInterval(id);
}
const nowInSeconds = () => Math.floor(Date.now() / 1000);
const beforeHydration = () => null;

/** Time left until the next business midnight after `now`, as hh:mm:ss. */
export function untilMidnight(now: number) {
  const left = Math.max(0, Math.ceil((dayFromNumber(dayNumber(now) + 1).getTime() - now) / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(Math.floor(left / 3600))}:${two(Math.floor((left % 3600) / 60))}:${two(left % 60)}`;
}

export function ResetCountdown({ language }: { language: Language }) {
  const t = COPY[language];
  const second = useSyncExternalStore(subscribe, nowInSeconds, beforeHydration);

  return (
    <p className="mt-2 text-sm text-ink-2">
      {t.resetsIn}{" "}
      {second === null ? (
        <span aria-hidden className="tabular invisible font-semibold">
          {localDigits("00:00:00", language)}
        </span>
      ) : (
        <span role="timer" className="tabular font-semibold text-ink">
          {localDigits(untilMidnight(second * 1000), language)}
        </span>
      )}
    </p>
  );
}
