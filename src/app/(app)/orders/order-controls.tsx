"use client";

import { useActionState, useEffect, useState } from "react";
import type { PurchaseOrderStatus } from "@/db/schema";
import { type OrderFormState, changeOrder } from "@/server/order-actions";
import type { Language } from "@/lib/i18n";
import { ORDERS_COPY } from "./copy";
import { FaultLine } from "@/components/fault";
import { notify } from "@/components/toasts";

const initial: OrderFormState = {};

/**
 * What can be done with an order next, by its state and the person: an admin places
 * or cancels a draft; anyone receives a placed order; an admin can cancel it. Received
 * and cancelled orders are history, so nothing prints for them, but this stays mounted
 * so that after the last action focus lands on the label's new status sentence.
 */
export function OrderControls({
  orderId,
  number,
  status,
  isAdmin,
  receipts,
  language,
}: {
  orderId: number;
  number: string;
  status: PurchaseOrderStatus;
  isAdmin: boolean;
  language: Language;
  /** What receiving books, in the ledger's terms: "+30 Widget, +10 Gadget". */
  receipts: string;
}) {
  const t = ORDERS_COPY[language];
  const [state, formAction, pending] = useActionState(changeOrder, initial);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<"place" | "cancel" | "receive" | null>(null);

  // The control that was pressed is gone once the order moves on; the status sentence
  // says where it moved to, so it takes focus, and a toast confirms what was done.
  useEffect(() => {
    if (!state.done) return;
    document.getElementById("order-status")?.focus();
    notify({ id: `order-${state.done.at}`, message: state.done.message, language });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  // A cancelled confirmation shouldn't survive into the order's next state.
  const [shownFor, setShownFor] = useState(status);
  if (shownFor !== status) {
    setShownFor(status);
    setConfirming(false);
  }

  if (status !== "draft" && status !== "ordered") return null;
  if (status === "draft" && !isAdmin) {
    return <p className="border-b-2 border-ink px-5 py-4 text-sm text-ink-2 sm:px-8">{t.adminPlaces}</p>;
  }

  const busy = t.busy;

  return (
    <section aria-label={t.nextStep} className="border-b-2 border-ink">
      <form action={formAction} aria-busy={pending}>
        <input type="hidden" name="orderId" value={orderId} />
        {status === "ordered" ? (
          <p className="max-w-prose px-5 pt-4 text-sm text-ink-2 sm:px-8">
            {t.receiveHelp}
            <span className="text-ink">{receipts}</span>
            {language === "bn" ? "।" : "."}
          </p>
        ) : null}

        <FaultLine message={pending ? undefined : state.error?.message} className="px-5 pt-3 sm:px-8" />

        <fieldset
          disabled={pending}
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-3 px-5 pt-3 pb-4 sm:px-8"
        >
          {confirming ? (
            <>
              <p className="min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
                {t.confirmCancel(number)}
              </p>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
              >
                {t.keep}
              </button>
              <PrintButton name="cancel" onSend={setSent}>
                {t.cancelOrder}
              </PrintButton>
            </>
          ) : (
            <>
              <p role="status" className="min-h-5 min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
                {pending && sent ? busy[sent] : null}
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
                >
                  {t.cancelOrder}
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

/** The step's primary button, reverse-printed. Its label never changes; the status line reports. */
function PrintButton({
  name,
  onSend,
  children,
}: {
  name: "place" | "cancel" | "receive";
  onSend: (intent: "place" | "cancel" | "receive") => void;
  children: string;
}) {
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
