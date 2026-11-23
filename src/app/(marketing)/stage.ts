"use client";

import { useSyncExternalStore } from "react";
import { milliseconds } from "@/lib/motion";

/**
 * Shared by the landing's moving parts: whether the reader asked for less motion (live,
 * so a change in system settings applies at once), and the stage timings from
 * landing.css, read where they're defined so script and CSS never disagree.
 */

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the reader asked for less motion. The server (and the first render) assume
 *  not, so the prerendered page is the same for everyone. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => matchMedia(REDUCE).matches,
    () => false,
  );
}

const subscribeNever = () => () => {};

/** False while hydrating (and on the server), true once the page is live in a browser. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

const FALLBACK = {
  "--dur-press": 150,
  "--dur-tear": 110,
  "--dur-reveal": 160,
  "--dur-impact": 220,
  "--dur-execute": 500,
  "--dur-execute-short": 350,
  "--dur-shake": 250,
  "--stagger": 50,
} as const;

export type StageToken = keyof typeof FALLBACK;

/** A timing token in milliseconds, read from the landing that `element` sits in. */
export function stageMs(element: Element | null, token: StageToken) {
  const scope = element?.closest(".landing") ?? document.documentElement;
  return milliseconds(getComputedStyle(scope).getPropertyValue(token)) || FALLBACK[token];
}
