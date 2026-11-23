"use client";

import { useEffect, useRef, useState } from "react";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { useReducedMotion } from "./stage";

/**
 * The ledger's On hand total as an odometer: each digit is a strip of 0–9 rolled to its
 * place in a clipped window. While the ledger prints with the scroll (landing.css), the
 * total follows it, showing the balance after the last line printed so far, and lands on
 * the real total as the last line prints.
 *
 * It only tallies where the ledger prints with the scroll (a browser with scroll-driven
 * animations, and motion allowed). Otherwise, before script runs, and to a screen reader,
 * it's simply the total.
 */
export function Odometer({ balances, language }: { balances: number[]; language: Language }) {
  const f = formats(language);
  const reduced = useReducedMotion();
  const total = balances[balances.length - 1];
  const [printed, setPrinted] = useState<number | null>(null);
  const figure = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ledger = figure.current?.closest("figure");
    if (!ledger || reduced || !CSS.supports("animation-timeline: view()")) return;
    const rows = [...ledger.querySelectorAll("[data-ledger-row]")];
    const done = rows.map(() => false);
    // A line has printed once its top passes 70% of the way up the screen, where its
    // print animation ends (`cover 30%` in landing.css), or once it has scrolled past.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          done[rows.indexOf(entry.target)] =
            entry.isIntersecting || entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
        }
        setPrinted(done.filter(Boolean).length);
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    rows.forEach((row) => observer.observe(row));
    return () => {
      observer.disconnect();
      setPrinted(null);
    };
  }, [reduced]);

  const shown = printed === null ? total : printed === 0 ? 0 : balances[printed - 1];
  const places = String(Math.max(...balances.map(Math.abs))).length;
  const digits = String(shown).padStart(places, " ");
  // Each strip: a blank (for a leading place) then 0–9, in the reader's digits.
  const strip = [" ", ...Array.from({ length: 10 }, (_, d) => f.count(d))];

  return (
    <p ref={figure} className="print-display tabular text-5xl">
      <span className="sr-only">{f.count(total)}</span>
      <span aria-hidden className="odometer">
        {[...digits].map((digit, place) => {
          const index = digit === " " ? 0 : Number(digit) + 1;
          return (
            <span key={place} className="odometer-window">
              <span className="odometer-strip" style={{ translate: `0 calc(${index} * -1 * var(--cell))` }}>
                {strip.map((cell, i) => (
                  <span key={i}>{cell}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </p>
  );
}
