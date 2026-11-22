"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Waits shorter than this go unremarked: the page arrives before a line could mean anything. */
const SHOW_AFTER = 150;
/** The line's crawl towards the end while it waits; it never reaches it on its own. */
const CRAWL = 8000;

/** A CSS time in milliseconds: the built stylesheet minifies "150ms" to ".15s". */
function milliseconds(time: string) {
  const value = parseFloat(time);
  return time.trim().endsWith("ms") ? value : value * 1000;
}

/** The motion tokens from globals.css, read where they're used, so the line moves like the rest of the app. */
function motion() {
  const root = getComputedStyle(document.documentElement);
  return {
    ease: root.getPropertyValue("--ease-out").trim() || "ease-out",
    fade: milliseconds(root.getPropertyValue("--dur-fade")) || 150,
    reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/**
 * A 2px ink line along the top of the window while a page is on its way. Most pages
 * are prefetched and arrive at once, so it only shows when a wait passes 150ms: a list
 * row nobody pointed at first, a slow connection. It starts when a click becomes a
 * client navigation (Next's links prevent the browser's own) or the browser goes back
 * or forward, and finishes, filling the width and fading, when the address changes.
 * Reduced motion keeps it as a line that fades in and out without growing.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const line = useRef<HTMLDivElement>(null);
  const crawl = useRef<Animation | null>(null);
  const address = useRef("");

  useEffect(() => {
    address.current = `${pathname}?${search}`;
    const element = line.current;
    const running = crawl.current;
    crawl.current = null;
    if (!element || !running) return;
    const shown = (Number(running.currentTime) || 0) > SHOW_AFTER;
    if (!shown) {
      running.cancel();
      return;
    }
    const { ease, fade, reduce } = motion();
    const from = getComputedStyle(element).transform;
    running.cancel();
    element.animate(
      reduce
        ? [
            { transform: "none", opacity: 1 },
            { transform: "none", opacity: 0 },
          ]
        : [
            { transform: from, opacity: 1 },
            { transform: "scaleX(1)", opacity: 1, offset: 0.5 },
            { transform: "scaleX(1)", opacity: 0 },
          ],
      { duration: reduce ? fade : fade * 2, easing: ease },
    );
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      const element = line.current;
      if (!element) return;
      for (const animation of element.getAnimations()) animation.cancel();
      const { ease, fade, reduce } = motion();
      crawl.current = element.animate(
        reduce
          ? [
              { transform: "none", opacity: 0 },
              { transform: "none", opacity: 1, offset: 0.02 },
              { transform: "none", opacity: 1 },
            ]
          : [{ transform: "scaleX(0)" }, { transform: "scaleX(0.9)" }],
        { duration: CRAWL, delay: SHOW_AFTER, easing: reduce ? "linear" : ease, fill: "both" },
      );
      // A navigation that never lands (refused, or abandoned for a hard load) mustn't
      // leave the line up: at the end of its crawl it fades.
      const crawled = crawl.current;
      crawled.finished
        .then(() => {
          if (crawl.current !== crawled) return;
          crawl.current = null;
          const width = getComputedStyle(element).transform;
          crawled.cancel();
          element.animate(
            [
              { transform: width, opacity: 1 },
              { transform: width, opacity: 0 },
            ],
            { duration: fade, easing: ease },
          );
        })
        .catch(() => {});
    };
    const here = (url: URL | Location) => `${url.pathname}?${new URLSearchParams(url.search).toString()}`;

    // Bubble phase on the window, so Next's link handler has already run: a click it
    // took as a client navigation is the one with its default prevented.
    const onClick = (event: MouseEvent) => {
      if (!event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== location.origin) return;
      if (here(new URL(anchor.href)) === address.current) return;
      start();
    };
    const onPopState = () => {
      if (here(location) !== address.current) start();
    };
    window.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return <div ref={line} aria-hidden className="nav-progress" />;
}
