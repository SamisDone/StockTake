"use client";

import { useEffect } from "react";

/**
 * Sections below the fold print in as they scroll into view, once each: the entry
 * number types out, then the heading and its lede rise. Anything already on screen when
 * the page wakes up stays as it is (hiding it now would make it blink), and with reduced
 * motion nothing is hidden at all. Without script the page simply shows everything.
 *
 * Elements opt in with `data-reveal`; this sets it to "waiting" (hidden, by landing.css)
 * and then "shown" (which plays the animation).
 */
export function Reveals() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...document.querySelectorAll<HTMLElement>(".landing [data-reveal]")];
    const fold = window.innerHeight;
    const waiting = items.filter((item) => item.getBoundingClientRect().top >= fold);
    if (waiting.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "shown";
          observer.unobserve(entry.target);
        }
      },
      // A little way in from the bottom edge, so the motion happens where the eye is.
      { rootMargin: "0px 0px -12% 0px" },
    );
    for (const item of waiting) {
      item.dataset.reveal = "waiting";
      observer.observe(item);
    }
    return () => observer.disconnect();
  }, []);

  return null;
}
