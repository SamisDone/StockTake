import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * Link `transitionTypes` for moving through the hierarchy. A link deeper into the app
 * (list → detail) is "nav-forward"; a link back up is "nav-back". Anything untyped (the
 * rail, redirects, the browser's back button) prints the new page in place.
 */
export const NAV_FORWARD = ["nav-forward"];
export const NAV_BACK = ["nav-back"];

const directional = { "nav-forward": "nav-forward", "nav-back": "nav-back" };

/**
 * Wraps a page's content, so it prints in on arrival and tears off on departure. Goes in
 * each page.tsx, not a layout: layouts persist across navigations, so they never enter.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ ...directional, default: "print" }}
      exit={{ ...directional, default: "tear" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/**
 * A Suspense boundary whose content fades in over its placeholder when the data arrives.
 * The page already printed in once with the placeholder in place, so the data doesn't
 * print a second time: the placeholder simply goes, and the content arrives in 150ms,
 * short enough that the page is never held unclickable for long.
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <ViewTransition enter="arrive" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
