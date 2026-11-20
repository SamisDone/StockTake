"use client";

import { useSyncExternalStore } from "react";

/**
 * View state a list keeps in the URL (filters, a search), so a filtered list can be
 * shared or reloaded. It lives in the hash, never the query: the server never needs
 * it, and changing the query with history.replaceState leaves Next.js's router
 * believing the page was rendered for the old one. A Server Action in a drawer opened
 * over the list then refreshes into a full-page reload instead of the drawer.
 */

const subscribeNever = () => () => {};
const readHash = () => window.location.hash;

/**
 * The hash the page arrived with, as parameters: null while rendering on the server,
 * which never sees it. Read it once, when it first turns non-null; after that the
 * page's own state writes the hash.
 */
export function useArrivalHash() {
  const hash = useSyncExternalStore(subscribeNever, readHash, () => null);
  return hash === null ? null : new URLSearchParams(hash.slice(1));
}

/** Writes view state into the hash without a navigation; empty values are left out. */
export function writeHash(pathname: string, state: Record<string, string>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) if (value) next.set(key, value);
  const hash = next.size ? `#${next}` : "";
  if (hash !== window.location.hash)
    window.history.replaceState(null, "", `${pathname}${window.location.search}${hash}`);
}
