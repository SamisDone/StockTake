"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** The chosen option in a row: a checked radio's label, or the current filter link. */
const CHOSEN = ':scope > label:has(input:checked), :scope > [aria-current="true"]';

/**
 * A row of choices whose reverse print is one pill that slides to the option chosen,
 * so the eye follows the choice from where it was rather than seeing one option go dark
 * as another lights up. Options print their own reverse until the pill is placed (and
 * without script); the pill lands without moving on first render, after a resize and
 * under reduced motion. The row scrolls with its pill inside it.
 */
export function PillRow({ className, children }: { className: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const chosen = useRef<Element | null>(null);

  // Puts the pill under the chosen option; it slides there only from another option.
  const place = useRef((slide: boolean) => {
    const box = row.current;
    const mark = pill.current;
    if (!box || !mark) return;
    const option = box.querySelector<HTMLElement>(CHOSEN);
    if (!option) {
      chosen.current = null;
      mark.style.opacity = "0";
      return;
    }
    // Already there, or on its way: a re-render must not cut a slide short.
    if (slide && option === chosen.current) return;
    const moves = slide && chosen.current !== null;
    if (!moves) mark.style.transition = "none";
    mark.style.translate = `${option.offsetLeft}px ${option.offsetTop}px`;
    mark.style.width = `${option.offsetWidth}px`;
    mark.style.height = `${option.offsetHeight}px`;
    mark.style.opacity = "1";
    if (!moves) {
      mark.getBoundingClientRect(); // lands where it is before transitions come back
      mark.style.transition = "";
    }
    chosen.current = option;
    box.dataset.pill = "";
  });

  // A re-render can change the choice without an event (a filter restored from the
  // address, a link's page arriving), so every commit checks.
  useLayoutEffect(() => place.current(true));

  useEffect(() => {
    const box = row.current;
    if (!box) return;
    const slide = () => place.current(true);
    const land = () => place.current(false);
    box.addEventListener("change", slide);
    // Options change width with the language and as fonts load.
    const sizes = new ResizeObserver(land);
    // Not the pill: its own width changes as it slides.
    for (const option of box.children) if (option !== pill.current) sizes.observe(option);
    return () => {
      box.removeEventListener("change", slide);
      sizes.disconnect();
    };
  }, []);

  return (
    <div ref={row} className={`relative ${className}`}>
      <span ref={pill} aria-hidden className="pill" style={{ opacity: 0 }} />
      {children}
    </div>
  );
}
