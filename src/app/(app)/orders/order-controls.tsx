"use client";

import { useActionState, useEffect, useState } from "react";
import type { PurchaseOrderStatus } from "@/db/schema";
import { type OrderFormState, changeOrder } from "@/server/order-actions";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { ORDERS_COPY } from "./copy";
import { FaultLine } from "@/components/fault";
import { notify } from "@/components/toasts";

const initial: OrderFormState = {};

type Intent = "place" | "cancel" | "receive" | "close";

/** A placed order's line, as the delivery form needs it. */
export type DeliveryLine = { id: number; name: string; quantity: number; received: number };

/**
 * What can be done with an order next, by its state and the person: an admin places
 * or cancels a draft; anyone receives a placed order, all of it or part, line by line;
 * an admin cancels a placed order nothing has come in on, or closes a partly received
 * one short. Received and cancelled orders are history, so nothing prints for them, but
 * this stays mounted so that after the last action focus lands on the label's new
 * status sentence.
 */
export function OrderControls({
  orderId,
  number,
  status,
  isAdmin,
  lines,
  language,
}: {
  orderId: number;
  number: string;
  status: PurchaseOrderStatus;
  isAdmin: boolean;
  lines: DeliveryLine[];
  language: Language;
}) {
  const t = ORDERS_COPY[language];
  const f = formats(language);
  const [state, formAction, pending] = useActionState(changeOrder, initial);
  const [confirming, setConfirming] = useState<"cancel" | "close" | null>(null);
  const [sent, setSent] = useState<Intent | null>(null);

  // The control that was pressed is gone once the order moves on; the status sentence
  // says where it moved to, so it takes focus, and a toast confirms what was done.
  useEffect(() => {
    if (!state.done) return;
    document.getElementById("order-status")?.focus();
    notify({ id: `order-${state.done.at}`, message: state.done.message, language });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  // A confirmation shouldn't survive into the order's next state, or the next delivery.
  const arrived = lines.reduce((total, line) => total + line.received, 0);
  const shownFor = `${status}:${arrived}`;
  const [seenFor, setSeenFor] = useState(shownFor);
  if (seenFor !== shownFor) {
    setSeenFor(shownFor);
    setConfirming(null);
  }

  if (status !== "draft" && status !== "ordered") return null;
  if (status === "draft" && !isAdmin) {
    return <p className="border-b-2 border-ink px-5 py-4 text-sm text-ink-2 sm:px-8">{t.adminPlaces}</p>;
  }

  const short = lines.reduce((total, line) => total + line.quantity - line.received, 0);
  const quiet =
    "press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1";

  return (
    <section aria-label={t.nextStep} className="border-b-2 border-ink">
      <form action={formAction} aria-busy={pending}>
        <input type="hidden" name="orderId" value={orderId} />
        {status === "ordered" ? (
          <Delivery
            lines={lines}
            fault={pending ? undefined : state.error?.field}
            disabled={pending}
            language={language}
          />
        ) : null}

        <FaultLine message={pending ? undefined : state.error?.message} className="px-5 pt-3 sm:px-8" />

        <fieldset
          disabled={pending}
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-3 px-5 pt-3 pb-4 sm:px-8"
        >
          {confirming ? (
            <>
              <p className="min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
                {confirming === "cancel" ? t.confirmCancel(number) : t.confirmClose(number, f.count(short))}
              </p>
              <button type="button" onClick={() => setConfirming(null)} className={quiet}>
                {confirming === "cancel" ? t.keep : t.keepWaiting}
              </button>
              <PrintButton name={confirming} onSend={setSent}>
                {confirming === "cancel" ? t.cancelOrder : t.closeShort}
              </PrintButton>
            </>
          ) : (
            <>
              <p role="status" className="min-h-5 min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
                {pending && sent ? t.busy[sent] : null}
              </p>
              {/* Nothing in yet: an admin can cancel. Something in: close it short instead. */}
              {isAdmin && arrived === 0 ? (
                <button type="button" onClick={() => setConfirming("cancel")} className={quiet}>
                  {t.cancelOrder}
                </button>
              ) : null}
              {isAdmin && arrived > 0 ? (
                <button type="button" onClick={() => setConfirming("close")} className={quiet}>
                  {t.closeShort}
                </button>
              ) : null}
              {status === "draft" ? (
                <PrintButton name="place" onSend={setSent}>
                  {t.placeOrder}
                </PrintButton>
              ) : (
                <PrintButton name="receive" onSend={setSent}>
                  {t.receiveDelivery}
                </PrintButton>
              )}
            </>
          )}
        </fieldset>
      </form>
    </section>
  );
}

/**
 * The delivery, line by line: what's still due and what arrived, which starts at the
 * whole amount due (the usual delivery) and is changed only where it came up short.
 * Lines already in full say so and take nothing.
 */
function Delivery({
  lines,
  fault,
  disabled,
  language,
}: {
  lines: DeliveryLine[];
  fault?: string;
  disabled: boolean;
  language: Language;
}) {
  const t = ORDERS_COPY[language];
  const f = formats(language);
  return (
    <div className="pt-4">
      <p className="max-w-prose px-5 text-sm text-ink-2 sm:px-8">{t.deliveryHelp}</p>
      <table className="mt-3 w-full border-collapse text-left text-sm">
        <caption className="sr-only">{t.deliveryCaption}</caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="field-name w-full pt-1 pr-4 pb-2 pl-5 sm:pl-8">
              {t.lineColumns.product}
            </th>
            <th scope="col" className="field-name pt-1 pr-4 pb-2 text-right whitespace-nowrap">
              {t.dueColumn}
            </th>
            <th scope="col" className="field-name pt-1 pr-5 pb-2 text-right sm:pr-8">
              {t.arrivedColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const due = line.quantity - line.received;
            const name = `receive-${line.id}`;
            const wrong = fault === name;
            return (
              <tr key={line.id} className="border-b border-hairline last:border-b-0">
                <td className={`py-2 pr-4 pl-5 font-semibold sm:pl-8 ${due === 0 ? "text-ink-2" : ""}`}>{line.name}</td>
                <td className="tabular py-2 pr-4 text-right">{f.count(due)}</td>
                <td className="py-1.5 pr-5 text-right sm:pr-8">
                  {due === 0 ? (
                    <span className="text-ink-2">{t.allIn}</span>
                  ) : (
                    <input
                      // A new delivery starts from what's due again.
                      key={due}
                      name={name}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      defaultValue={String(due)}
                      disabled={disabled}
                      aria-label={t.arrivedLabel(line.name)}
                      aria-invalid={wrong || undefined}
                      className={`tabular h-10 w-20 rounded-none border bg-label px-2 text-right font-semibold outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] ${
                        wrong ? "fault-rule border-fault" : "border-ink"
                      }`}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The step's primary button, reverse-printed. Its label never changes; the status line reports. */
function PrintButton({ name, onSend, children }: { name: Intent; onSend: (intent: Intent) => void; children: string }) {
  return (
    <button
      type="submit"
      name="intent"
      value={name}
      onClick={() => onSend(name)}
      className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
    >
      <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
        {children}
      </span>
    </button>
  );
}
