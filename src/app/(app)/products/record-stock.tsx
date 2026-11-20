"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { Choice } from "@/components/choice";
import { Field } from "@/components/field";
import { formatChange, formatCount } from "@/lib/format";
import { parseUnits } from "@/lib/parse";
import { type StockFormState, type StockKind, recordStock } from "@/server/stock-actions";

const KINDS: { kind: StockKind; label: string; quantity: string; submit: string }[] = [
  { kind: "count", label: "Count", quantity: "Counted on the shelf", submit: "Record count" },
  { kind: "sale", label: "Sale", quantity: "Units sold", submit: "Record sale" },
  { kind: "return", label: "Return", quantity: "Units returned", submit: "Record return" },
  { kind: "write_off", label: "Write-off", quantity: "Units written off", submit: "Record write-off" },
];

const initial: StockFormState = {};

/**
 * Records a count, sale, return or write-off against one product. Before anything is
 * sent, the form says what the entry will do to on hand, in the ledger's own terms.
 */
export function RecordStock({
  productId,
  onHand,
  headingLevel,
}: {
  productId: number;
  onHand: number;
  headingLevel: 2 | 3;
}) {
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

  const spec = KINDS.find((k) => k.kind === kind)!;
  const error = state.error;
  const quantityError = error?.field === "quantity" ? error.message : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby="record-title" className="border-b-2 border-ink">
      <div className="px-5 pt-5 sm:px-8">
        <Heading id="record-title" className="text-lg font-bold">
          Record stock
        </Heading>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          Each entry is a new line in the ledger. A count that differs from the system is recorded as an adjustment.
        </p>
      </div>

      <form action={formAction} aria-busy={pending} className="mt-3">
        <input type="hidden" name="productId" value={productId} />
        <fieldset disabled={pending}>
          <fieldset className="px-5 pb-3 sm:px-8">
            <legend className="sr-only">What happened</legend>
            <div className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <Choice
                  key={k.kind}
                  name="kind"
                  value={k.kind}
                  defaultChecked={defaultKind === k.kind}
                  onSelect={() => setKind(k.kind)}
                >
                  {k.label}
                </Choice>
              ))}
            </div>
          </fieldset>

          <div className="grid border-y border-ink sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <Field name="quantity" label={spec.quantity} error={quantityError}>
              <input
                id="quantity"
                name="quantity"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={state.values?.quantity}
                onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={quantityError ? true : undefined}
                aria-describedby={quantityError ? "quantity-error" : "quantity-effect"}
                className="field-input"
              />
            </Field>
            <Field name="note" label={kind === "write_off" ? "Reason" : "Note"} optional divided>
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
            <Effect kind={kind} onHand={onHand} quantity={parseUnits(quantity)} />
          </p>

          {error && !error.field ? (
            <p role="alert" className="mt-3 bg-stock px-5 py-3 text-sm font-medium sm:px-8">
              {error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            {/* Announced when it changes; keyed so each new entry prints in fresh. It holds a
                line even when empty, so nothing below it moves when it speaks. */}
            <p role="status" className="min-h-5 min-w-0 flex-1 text-sm font-medium">
              {pending ? (
                "Recording…"
              ) : state.done ? (
                <span key={state.done.at} className="print-in flex items-start gap-1.5">
                  <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                  {state.done.message}
                </span>
              ) : null}
            </p>
            <button
              type="submit"
              className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
            >
              {/* Every kind's label in one cell, so the button is always as wide as the
                  longest and never changes width; the status line says when it's working. */}
              <span className="inline-grid transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {KINDS.map((k) => (
                  <span key={k.kind} className={`col-start-1 row-start-1 ${k.kind === kind ? "" : "invisible"}`}>
                    {k.submit}
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
function Effect({ kind, onHand, quantity }: { kind: StockKind; onHand: number; quantity: number | null }) {
  const now = <strong className="font-semibold text-ink">{formatCount(onHand)}</strong>;
  if (quantity === null) return <>The ledger says {now} on hand.</>;

  if (kind === "count") {
    const difference = quantity - onHand;
    return difference === 0 ? (
      <>Matches the {now} on hand: logged, with no adjustment.</>
    ) : (
      <>
        Adjusts on hand by <strong className="font-semibold text-ink">{formatChange(difference)}</strong>, from {now} to{" "}
        {formatCount(quantity)}.
      </>
    );
  }
  const after = kind === "return" ? onHand + quantity : onHand - quantity;
  if (after < 0) return <>Only {now} on hand, so the ledger will refuse this.</>;
  return quantity === 0 ? (
    <>Enter at least 1.</>
  ) : (
    <>
      On hand goes from {now} to <strong className="font-semibold text-ink">{formatCount(after)}</strong>.
    </>
  );
}
