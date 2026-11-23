"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PurchaseOrderStatus } from "@/db/schema";
import { Choice, Choices } from "@/components/choice";
import { useArrivalHash, writeHash } from "@/components/hash-state";
import { type Sort, SortTh, parseSort, sortParam, sortRows } from "@/components/sort";
import { MobileName, Th } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyFormat, type MoneyPrefs, moneyFormat } from "@/lib/money";
import { ORDERS_COPY, type OrdersCopy } from "./copy";
import { MARK_BASE, ORDER_MARK } from "./status";
import { RememberLink } from "@/components/known-title";
import { TitleMorph } from "@/components/title-morph";

export type OrderRow = {
  id: number;
  number: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  lineCount: number;
  totalCents: number;
  /** The date that matters for the order's state, in words: "Due Nov 28", "Received Nov 12". */
  when: string;
  /** That date as a number, for sorting; null when the order has none (placed, no due date). */
  sortAt: number | null;
  /** Placed and past its due date. */
  late: boolean;
  /** Placed, and part of it has come in. */
  partly: boolean;
};

const SORTS = ["lines", "total", "date"] as const;
type SortKey = (typeof SORTS)[number];
const sortValue = (row: OrderRow, key: SortKey) =>
  key === "lines" ? row.lineCount : key === "total" ? row.totalCents : row.sortAt;

type Show = "open" | PurchaseOrderStatus | "all";
const SHOWS: Show[] = ["open", "draft", "ordered", "received", "cancelled", "all"];

const matches = (show: Show, row: OrderRow) =>
  show === "all" || (show === "open" ? row.status === "draft" || row.status === "ordered" : row.status === show);

/**
 * Every order, late ones pinned to the top and the rest newest first, filtered by state
 * in the browser (the list is tens of orders). Open, drafts and placed orders, is where
 * work is, so it's the default. Lines, total and date sort on a click. The filter and
 * the sort live in the URL's hash, like the products list's.
 */
export function OrderTable({ rows, money, language }: { rows: OrderRow[]; money: MoneyPrefs; language: Language }) {
  const t = ORDERS_COPY[language];
  const f = formats(language);
  const m = moneyFormat(money, language);
  const pathname = usePathname();
  const [show, setShow] = useState<Show>("open");
  const [switches, setSwitches] = useState(0);
  const [sort, setSort] = useState<Sort<SortKey>>(null);

  const hash = useArrivalHash();
  const [arrived, setArrived] = useState(false);
  if (!arrived && hash !== null) {
    setArrived(true);
    const wanted = SHOWS.find((s) => s === hash.get("show"));
    if (wanted) setShow(wanted);
    setSort(parseSort(hash.get("sort"), SORTS));
  }

  useEffect(() => {
    if (pathname !== "/orders" || !arrived) return;
    writeHash(pathname, { show: show === "open" ? "" : show, sort: sortParam(sort) });
  }, [pathname, arrived, show, sort]);

  const filtered = rows.filter((row) => matches(show, row));
  const shown = sort
    ? sortRows(filtered, sort, sortValue)
    : [...filtered].sort((a, b) => Number(b.late) - Number(a.late));

  return (
    <section aria-labelledby="orders-title" className="pb-8">
      <h2 id="orders-title" className="sr-only">
        {t.orders}
      </h2>
      <div className="border-b-2 border-ink">
        <Choices legend={t.show}>
          {SHOWS.map((option) => (
            <Choice
              key={option}
              name="orders-show"
              checked={show === option}
              onSelect={() => {
                setShow(option);
                setSwitches((n) => n + 1);
              }}
            >
              {t.shows[option]}{" "}
              <span className="ml-1.5">{f.count(rows.filter((row) => matches(option, row)).length)}</span>
            </Choice>
          ))}
        </Choices>
      </div>

      {/* Same place, different content: the new rows fade in, never on first render. */}
      <div key={show} className={`pt-2 ${switches > 0 ? "swap-in" : ""}`}>
        {shown.length === 0 ? (
          <p className="px-5 pt-4 font-semibold sm:px-8">{t.empty[show]}</p>
        ) : (
          <table className="w-full border-collapse text-left max-md:block">
            <caption className="sr-only">{t.caption(f.count(shown.length))}</caption>
            <thead className="sticky-head max-md:hidden">
              <tr className="border-b border-ink">
                <Th>{t.columns.order}</Th>
                <Th>{t.columns.status}</Th>
                <SortTh sortKey="lines" sort={sort} onSort={setSort} align="right">
                  {t.columns.lines}
                </SortTh>
                <SortTh sortKey="total" sort={sort} onSort={setSort} align="right">
                  {t.columns.total}
                </SortTh>
                <SortTh sortKey="date" sort={sort} onSort={setSort}>
                  {t.columns.date}
                </SortTh>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {shown.map((row) => (
                <Row key={row.id} row={row} m={m} f={f} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/** One order: the supplier's name opens it, and the whole row is the hit area. */
function Row({ row, m, f, t }: { row: OrderRow; m: MoneyFormat; f: Formats; t: OrdersCopy }) {
  return (
    <tr className="relative border-b border-hairline align-top row-hit last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 max-md:col-span-3 max-md:p-0 md:pl-8">
        <div className="flex items-baseline gap-2">
          <RememberLink
            href={`/orders/${row.id}`}
            transitionTypes={NAV_FORWARD}
            remember={{
              kind: "order",
              id: row.id,
              title: row.supplierName,
              number: row.number,
              status: { text: t.status[row.status], mark: `${MARK_BASE} ${ORDER_MARK[row.status]}` },
            }}
            className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            <TitleMorph kind="order" id={row.id}>
              <span className="inline-block">{row.supplierName}</span>
            </TitleMorph>
          </RememberLink>
        </div>
        <p className="mt-0.5 font-mono text-xs text-ink-3">
          <TitleMorph kind="order" id={row.id} part="number">
            <span className="inline-block">{row.number}</span>
          </TitleMorph>
        </p>
      </td>
      <td className="py-3 pr-4 max-md:p-0">
        <MobileName>{t.columns.status}</MobileName>
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span className={`${MARK_BASE} ${ORDER_MARK[row.status]}`}>{t.status[row.status]}</span>
          {/* Late is attention, so it's printed on the stock yellow, beside the state it qualifies. */}
          {row.late ? (
            <span className="inline-block rounded-mark border border-stock bg-stock px-1.5 py-px text-xs font-bold">
              {t.late}
            </span>
          ) : null}
          {row.partly ? <span className="text-xs font-semibold text-ink-2">{t.partlyIn}</span> : null}
        </span>
      </td>
      <td className="tabular py-3 pr-4 text-right max-md:hidden">{f.count(row.lineCount)}</td>
      <td className="tabular py-3 pr-4 text-right font-semibold max-md:p-0 max-md:text-left">
        <MobileName>{t.columns.total}</MobileName>
        {m.money(row.totalCents)}
      </td>
      <td className="py-3 whitespace-nowrap text-ink-2 max-md:p-0 md:pr-8">
        <MobileName>{t.columns.date}</MobileName>
        {row.when}
      </td>
    </tr>
  );
}
