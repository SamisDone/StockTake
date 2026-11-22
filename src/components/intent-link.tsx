"use client";

import Link, { type LinkProps, useLinkStatus } from "next/link";
import { useState } from "react";

/**
 * A link in a list of many (a table row, a ledger entry): it prefetches its page once
 * someone shows intent (the pointer arrives, a finger lands, focus moves to it) instead
 * of as soon as it scrolls into view. On Workers every prefetch is a request with its
 * own CPU time, and a list prefetching every row it shows would spend that on pages
 * nobody opens. The intent comes ~100ms or more before the click, which is most of a
 * round trip, so the page is usually ready when it's opened.
 */
export function IntentLink<Route>({ onPointerEnter, onFocus, onTouchStart, children, ...props }: LinkProps<Route>) {
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
    >
      {children}
      <Pending />
    </Link>
  );
}

/**
 * Marks the link while its page is on the way, when it wasn't ready at the click (a
 * prefetched page arrives at once and never marks). A `row-hit` row holding the mark
 * stays pressed, so the row answers the click until the page replaces it, rather than
 * going quiet the moment the finger lifts.
 */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending /> : null;
}
