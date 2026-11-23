import type { ReactNode } from "react";
import { MARK_BASE, ORDER_MARK } from "../orders/status";

/**
 * Printed marks for sales and customers. Money still owed needs following up, so it's
 * printed on yellow attention stock like Reorder and Late; a voided sale is history,
 * ruled in grey like a cancelled order. Plain components, for server and client code.
 */
export function DueMark({ children }: { children: ReactNode }) {
  return (
    <span className="tabular rounded-mark bg-stock px-1.5 py-px text-sm font-bold whitespace-nowrap">{children}</span>
  );
}

export function VoidedMark({ label }: { label: string }) {
  return <span className={`${MARK_BASE} ${ORDER_MARK.cancelled}`}>{label}</span>;
}
