"use client";

import { type ReactNode, useState, useTransition } from "react";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import type { LedgerEntry } from "@/server/ledger";
import { olderMovements } from "@/server/stock-actions";
import { Arrival, ArrivalScope } from "@/components/arrival";
import { PRODUCTS_COPY } from "./copy";

/**
 * The ledger: one row per movement with the running balance after it, newest first. It
 * prints the newest page; "Show older" appends the page before the last row shown, so a
 * long history never weighs on the label until someone asks for it. A new movement
 * refreshes the label with a fresh first page: the ledger starts over from it, and the
 * new line prints in at the top while the lines already shown stay where they were
 * printed.
 */
export function Ledger({
  productId,
  initial,
  total,
  now,
  language,
}: {
  productId: number;
  initial: LedgerEntry[];
  total: number;
  now: Date;
  language: Language;
}) {
  const t = PRODUCTS_COPY[language];
  const f = formats(language);
  const c = t.ledgerColumns;
  const [movements, setMovements] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [loading, startLoading] = useTransition();
  const last = movements.at(-1);

  // A new movement changes the newest entry and the total: start over from the new page.
  const [printed, setPrinted] = useState({ top: initial[0]?.id, total });
  if (printed.top !== initial[0]?.id || printed.total !== total) {
    setPrinted({ top: initial[0]?.id, total });
    setMovements(initial);
    setFailed(false);
  }

  // One scope for the ledger's life, empty or not, so even a product's first movement prints in.
  if (movements.length === 0) {
    return (
      <ArrivalScope>
        <p className="mt-4 px-5 font-semibold sm:px-8">{t.noMovements}</p>
      </ArrivalScope>
    );
  }

  const showOlder = () => {
    if (!last) return;
    setFailed(false);
    startLoading(async () => {
      try {
        const older = await olderMovements({ productId, occurredAt: last.occurredAt.getTime(), id: last.id });
        setMovements((shown) => [...shown, ...older]);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <ArrivalScope>
      <table className="mt-4 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ink">
            <LedgerTh className="pl-5 sm:pl-8">{c.date}</LedgerTh>
            <LedgerTh className="w-full">{c.movement}</LedgerTh>
            <LedgerTh align="right">{c.change}</LedgerTh>
            <LedgerTh align="right" className="pr-5 sm:pr-8 md:pr-4">
              {c.balance}
            </LedgerTh>
            <LedgerTh className="max-md:hidden md:pr-8">{c.by}</LedgerTh>
          </tr>
        </thead>
        <tbody>
          {movements.map((move, index) => (
            <Arrival as="tr" key={move.id} className="border-b border-hairline align-top last:border-b-0">
              <td className="py-2.5 pr-4 pl-5 whitespace-nowrap text-ink-2 sm:pl-8">{f.date(move.occurredAt, now)}</td>
              <td className="py-2.5 pr-4">
                {/* An undo names what it reversed; the line it reversed says it was undone. Both stay. */}
                <span className="font-semibold">
                  {move.reversedKind ? t.undoOf(t.kinds[move.reversedKind]) : t.kinds[move.kind]}
                </span>
                {move.undone ? (
                  <span className="ml-2 rounded-mark border border-ink-3 px-1.5 py-px text-xs font-bold text-ink-3">
                    {t.undoneMark}
                  </span>
                ) : null}
                {move.po ? <span className="ml-2 font-mono text-xs text-ink-3">{move.po}</span> : null}
                {move.note ? <p className="text-ink-3">{move.note}</p> : null}
                {move.userName ? <p className="text-ink-3 md:hidden">{move.userName}</p> : null}
              </td>
              <td className="tabular py-2.5 pr-4 text-right font-semibold">{f.change(move.quantity)}</td>
              <td
                className={`tabular py-2.5 pr-5 text-right sm:pr-8 md:pr-4 ${index === 0 ? "font-bold" : "text-ink-2"}`}
              >
                {f.count(move.balance)}
              </td>
              <td className="py-2.5 whitespace-nowrap text-ink-2 max-md:hidden md:pr-8">{move.userName ?? "–"}</td>
            </Arrival>
          ))}
        </tbody>
      </table>
      {total > movements.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 sm:px-5">
          <button
            type="button"
            onClick={showOlder}
            disabled={loading}
            aria-busy={loading}
            className="press-quiet grid min-h-11 rounded-control px-3 text-sm font-semibold enabled:hover:bg-liner disabled:text-ink-3"
          >
            {/* Both labels hold the space, so the button keeps its width while it loads. */}
            <span className={`col-start-1 row-start-1 self-center ${loading ? "invisible" : ""}`}>{t.showOlder}</span>
            <span
              aria-hidden={!loading}
              className={`col-start-1 row-start-1 self-center ${loading ? "" : "invisible"}`}
            >
              {t.loadingOlder}
            </span>
          </button>
          <p aria-live="polite" className="text-sm text-ink-2">
            {failed ? t.olderFailed : t.showing(f.count(movements.length), f.count(total))}
          </p>
        </div>
      ) : null}
    </ArrivalScope>
  );
}

function LedgerTh({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th scope="col" className={`field-name pt-1 pr-4 pb-2 ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </th>
  );
}
