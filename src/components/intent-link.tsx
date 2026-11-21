"use client";

import Link, { type LinkProps } from "next/link";
import { useState } from "react";

/**
 * A link in a list of many (a table row, a ledger entry): it prefetches its page once
 * someone shows intent (the pointer arrives, a finger lands, focus moves to it) instead
 * of as soon as it scrolls into view. On Workers every prefetch is a request with its
 * own CPU time, and a list prefetching every row it shows would spend that on pages
 * nobody opens. The intent comes ~100ms or more before the click, which is most of a
 * round trip, so the page is usually ready when it's opened.
 */
export function IntentLink<Route>({ onPointerEnter, onFocus, onTouchStart, ...props }: LinkProps<Route>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
