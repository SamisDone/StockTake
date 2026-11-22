"use client";

import { useState } from "react";
import type { PurchaseOrderStatus } from "@/db/schema";
import { MARK_BASE, ORDER_MARK } from "./status";

/**
 * The order's status mark in its label's header. When the order moves on while the
 * label is open (placed, received, cancelled), the new mark is stamped on: it lands
 * from a touch larger and settles. It prints plainly on first render.
 */
export function StatusStamp({ status, label }: { status: PurchaseOrderStatus; label: string }) {
  const [shown, setShown] = useState(status);
  const [stamping, setStamping] = useState(false);
  if (shown !== status) {
    setShown(status);
    setStamping(true);
  }
  return (
    <span
      key={status}
      onAnimationEnd={(event) => {
        if (event.animationName === "stamp") setStamping(false);
      }}
      className={`${MARK_BASE} ${ORDER_MARK[status]} ${stamping ? "stamp-in" : ""}`}
    >
      {label}
    </span>
  );
}
