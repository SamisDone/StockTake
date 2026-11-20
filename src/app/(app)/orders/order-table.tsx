"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PurchaseOrderStatus } from "@/db/schema";
import { Choice, Choices } from "@/components/choice";
import { useArrivalHash, writeHash } from "@/components/hash-state";
import { MobileName, Th } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { formatCount, formatMoney } from "@/lib/format";
import { STATUS_WORD } from "./status";

export type OrderRow = {
  id: number;
  number: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  lineCount: number;
  totalCents: number;
  /** The date that matters for the order's state, in words: "Due Nov 28", "Received Nov 12". */
  when: string;
  /** Placed and past its due date. */
  late: boolean;
};

type Show = "open" | PurchaseOrderStatus | "all";
const SHOWS: { show: Show; label: string }[] = [
  { show: "open", label: "Open" },
  { show: "draft", label: "Drafts" },
  { show: "ordered", label: "Placed" },
  { show: "received", label: "Received" },
  { show: "cancelled", label: "Cancelled" },
  { show: "all", label: "All" },
];

const matches = (show: Show, row: OrderRow) =>
  show === "all" || (show === "open" ? row.status === "draft" || row.status === "ordered" : row.status === show);

/**
 * Every order, newest first, filtered by state in the browser (the list is tens of
 * orders). Open, drafts and placed orders, is where work is, so it's the default. The
 * filter lives in the URL's hash, like the products list's.
 */
export function OrderTable({ rows }: { rows: OrderRow[] }) {
  const pathname = usePathname();
  const [show, setShow] = useState<Show>("open");
  const [switches, setSwitches] = useState(0);

  const hash = useArrivalHash();
  const [arrived, setArrived] = useState(false);
  if (!arrived && hash !== null) {
    setArrived(true);
    const wanted = SHOWS.find((s) => s.show === hash.get("show"));
    if (wanted) setShow(wanted.show);
  }

  useEffect(() => {
    if (pathname !== "/orders" || !arrived) return;
    writeHash(pathname, { show: show === "open" ? "" : show });
  }, [pathname, arrived, show]);

  const shown = rows.filter((row) => matches(show, row));

  return (
    <section aria-labelledby="orders-title" className="pb-8">
      <h2 id="orders-title" className="sr-only">
        Orders
      </h2>
      <div className="border-b-2 border-ink">
        <Choices legend="Show">
          {SHOWS.map(({ show: option, label }) => (
            <Choice
              key={option}
              name="show"
              checked={show === option}
              onSelect={() => {
                setShow(option);
                setSwitches((n) => n + 1);
              }}
            >
              {label} <span className="ml-1.5">{formatCount(rows.filter((row) => matches(option, row)).length)}</span>
            </Choice>
          ))}
        </Choices>
      </div>

      {/* Same place, different content: the new rows fade in, never on first render. */}
      <div key={show} className={`pt-2 ${switches > 0 ? "swap-in" : ""}`}>
        {shown.length === 0 ? (
          <p className="px-5 pt-4 font-semibold sm:px-8">{EMPTY[show]}</p>
        ) : (
          <table className="w-full border-collapse text-left max-md:block">
            <caption className="sr-only">
              {formatCount(shown.length)} orders, newest first. Select one to see its lines and history.
            </caption>
            <thead className="max-md:hidden">
              <tr className="border-b border-ink">
                <Th>Order</Th>
                <Th>Status</Th>
                <Th align="right">Lines</Th>
                <Th align="right">Total</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {shown.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const EMPTY: Record<Show, string> = {
  open: "No open orders. Draft one from the suggestions above.",
  draft: "No drafts.",
  ordered: "Nothing is on order.",
  received: "Nothing has been received yet.",
  cancelled: "No cancelled orders.",
  all: "No orders yet.",
};

/** One order: the supplier's name opens it, and the whole row is the hit area. */
function Row({ row }: { row: OrderRow }) {
  return (
    <tr className="relative border-b border-hairline align-top transition-colors duration-150 last:border-b-0 hover:bg-liner/60 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0 md:pl-8">
        <div className="flex items-baseline gap-2">
          {row.late ? (
            <span className="shrink-0 rounded-mark bg-stock px-1.5 py-px text-xs font-bold">Late</span>
          ) : null}
          <Link
            href={`/orders/${row.id}`}
            prefetch={false}
            transitionTypes={NAV_FORWARD}
            className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {row.supplierName}
          </Link>
        </div>
        <p className="mt-0.5 font-mono text-xs text-ink-3">{row.number}</p>
      </td>
      <td className="py-3 pr-4 max-md:p-0">
        <MobileName>Status</MobileName>
        {STATUS_WORD[row.status]}
      </td>
      <td className="tabular py-3 pr-4 text-right max-md:hidden">{formatCount(row.lineCount)}</td>
      <td className="tabular py-3 pr-4 text-right font-semibold max-md:p-0 max-md:text-left">
        <MobileName>Total</MobileName>
        {formatMoney(row.totalCents)}
      </td>
      <td className="py-3 whitespace-nowrap text-ink-2 max-md:p-0 md:pr-8">
        <MobileName>Date</MobileName>
        {row.when}
      </td>
    </tr>
  );
}
