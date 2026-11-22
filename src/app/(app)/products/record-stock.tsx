"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { Choice } from "@/components/choice";
import { FaultLine } from "@/components/fault";
import { Field } from "@/components/field";
import { PillRow } from "@/components/pill-row";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { parseUnits } from "@/lib/parse";
import { type StockFormState, type StockKind, recordStock } from "@/server/stock-actions";
import { PRODUCTS_COPY, type ProductsCopy } from "./copy";

const KINDS: StockKind[] = ["count", "sale", "return", "write_off"];

const initial: StockFormState = {};

/**
 * Records a count, sale, return or write-off against one product. Before anything is
 * sent, the form says what the entry will do to on hand, in the ledger's own terms.
 */
export function RecordStock({
  productId,
  onHand,
  headingLevel,
  language,
}: {
  productId: number;
  onHand: number;
  headingLevel: 2 | 3;
  language: Language;
}) {
  const t = PRODUCTS_COPY[language];
  const [state, formAction, pending] = useActionState(recordStock, initial);
  const [kind, setKind] = useState<StockKind>("count");
  const [quantity, setQuantity] = useState("");

  // React resets the form's fields after an action, to their defaults: the answer's
  // values (what was typed on an error, a clean form after a success, the kind kept
  // either way). The fields are uncontrolled for that reason; this mirrors them.
  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    setKind((state.values?.kind as StockKind | undefined) ?? kind);
    setQuantity(state.values?.quantity ?? "");
  }
  const defaultKind = (state.values?.kind as StockKind | undefined) ?? "count";

  const spec = t.stockKinds[kind];
  // An error is about what was sent. Once the kind or the units change, it no longer
  // applies (a sale refused for want of stock says nothing about a count of 0).
  const sent = state.values;
  const stale = sent !== undefined && (sent.kind !== kind || (sent.quantity ?? "") !== quantity);
  const error = stale ? undefined : state.error;
  const quantityError = error?.field === "quantity" ? error.message : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby="record-title" className="border-b-2 border-ink">
      <div className="px-5 pt-5 sm:px-8">
        <Heading id="record-title" className="text-lg font-bold">
          {t.record}
        </Heading>
        <p className="mt-1 max-w-prose text-sm text-ink-2">{t.recordHelp}</p>
      </div>

      <form action={formAction} aria-busy={pending} className="mt-3">
        <input type="hidden" name="productId" value={productId} />
        <fieldset disabled={pending}>
          <fieldset className="px-5 pb-3 sm:px-8">
            <legend className="sr-only">{t.whatHappened}</legend>
            <PillRow className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <Choice key={k} name="kind" value={k} defaultChecked={defaultKind === k} onSelect={() => setKind(k)}>
                  {t.stockKinds[k].label}
                </Choice>
              ))}
            </PillRow>
          </fieldset>

          <div className="grid border-y border-ink sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <Field name="quantity" label={spec.quantity} error={quantityError} language={language}>
              <input
                id="quantity"
                name="quantity"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={state.values?.quantity}
                onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={quantityError ? true : undefined}
                aria-describedby={quantityError ? "quantity-error quantity-effect" : "quantity-effect"}
                className="field-input"
              />
            </Field>
            <Field name="note" label={kind === "write_off" ? t.reason : t.note} optional divided language={language}>
              <input
                id="note"
                name="note"
                maxLength={500}
                autoComplete="off"
                defaultValue={state.values?.note}
                className="field-input"
              />
            </Field>
          </div>

          <p id="quantity-effect" className="px-5 pt-2.5 text-sm text-ink-2 sm:px-8">
            <Effect kind={kind} onHand={onHand} quantity={parseUnits(quantity)} f={formats(language)} t={t} />
          </p>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            {/* Announced when it changes; keyed so each new entry prints in fresh. It holds a
                line even when empty, so nothing below it moves when it speaks, and a refusal
                that isn't about the quantity is printed in the same line. */}
            <div className="min-h-5 min-w-0 flex-1">
              <p role="status" className="text-sm font-medium">
                {pending ? (
                  t.recording
                ) : state.done ? (
                  <span key={state.done.at} className="print-in flex items-start gap-1.5">
                    <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                    {state.done.message}
                  </span>
                ) : null}
              </p>
              <FaultLine message={error && !error.field && !pending ? error.message : undefined} hold={false} />
            </div>
            <button
              type="submit"
              className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
            >
              {/* Every kind's label in one cell, so the button is always as wide as the
                  longest and never changes width; the status line says when it's working. */}
              <span className="inline-grid transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {KINDS.map((k) => (
                  <span key={k} className={`col-start-1 row-start-1 ${k === kind ? "" : "invisible"}`}>
                    {t.stockKinds[k].submit}
                  </span>
                ))}
              </span>
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

/** What the entry will do to on hand, worked out before it is sent. */
function Effect({
  kind,
  onHand,
  quantity,
  f,
  t,
}: {
  kind: StockKind;
  onHand: number;
  quantity: number | null;
  f: Formats;
  t: ProductsCopy;
}) {
  const e = t.effect;
  const now = <strong className="font-semibold text-ink">{f.count(onHand)}</strong>;
  if (quantity === null) {
    return (
      <>
        {e.ledgerSays[0]}
        {now}
        {e.ledgerSays[1]}
      </>
    );
  }

  if (kind === "count") {
    const difference = quantity - onHand;
    if (difference === 0) {
      return (
        <>
          {e.matches[0]}
          {now}
          {e.matches[1]}
        </>
      );
    }
    const adjusts = e.adjusts(f.change(difference), f.count(quantity));
    return (
      <>
        {adjusts.before}
        <strong className="font-semibold text-ink">{adjusts.change}</strong>
        {adjusts.middle}
        {now}
        {adjusts.after}
      </>
    );
  }
  const after = kind === "return" ? onHand + quantity : onHand - quantity;
  if (after < 0) {
    return (
      <>
        {e.refuse[0]}
        {now}
        {e.refuse[1]}
      </>
    );
  }
  return quantity === 0 ? (
    <>{e.atLeastOne}</>
  ) : (
    <>
      {e.goes[0]}
      {now}
      {e.goes[1]}
      <strong className="font-semibold text-ink">{f.count(after)}</strong>
      {e.goes[2]}
    </>
  );
}
