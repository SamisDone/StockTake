"use client";

import { useEffect, useRef, useState } from "react";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { duration, easingCurve, reducedMotion } from "@/lib/motion";

/**
 * A figure that counts over to its new value when it changes (stock recorded, a filter
 * narrowing a list, a line's quantity typed) instead of swapping in one frame, so the
 * eye sees which way it moved and by roughly how much. It prints its value as is on
 * first render. A change midway counts on from wherever it has got to. Reduced motion
 * swaps it at once. `counting` is true while it runs, so a figure can hold its digits
 * to one width then (and print the font's own figures at rest).
 */
export function useTicker(value: number) {
  const [shown, setShown] = useState(value);
  const [counting, setCounting] = useState(false);
  // Where the count is right now, between whole numbers, so a new target picks up from here.
  const at = useRef(value);

  useEffect(() => {
    const from = at.current;
    if (from === value) return;
    const total = reducedMotion() ? 0 : duration("--dur-tick", 400);
    const ease = easingCurve("--ease-out");
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = total === 0 ? 1 : Math.min(1, (now - start) / total);
      at.current = progress === 1 ? value : from + (value - from) * ease(progress);
      setShown(Math.round(at.current));
      setCounting(progress < 1);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return { shown, counting };
}

/** A whole count in the reader's digits that ticks over when it changes. */
export function Count({ value, language }: { value: number; language: Language }) {
  const { shown, counting } = useTicker(value);
  return <span className={counting ? "tabular" : undefined}>{formats(language).count(shown)}</span>;
}
