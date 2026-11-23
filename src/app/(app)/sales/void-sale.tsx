"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FaultLine } from "@/components/fault";
import { notify } from "@/components/toasts";
import type { Language } from "@/lib/i18n";
import { type VoidFormState, voidSaleAction } from "@/server/sale-actions";
import { SALES_COPY } from "./copy";

const initial: VoidFormState = {};

/**
 * Voiding a sale, for admins: it asks first, in place, since it can't be taken back.
 * Once done, the label refreshes to say so and a toast confirms it.
 */
export function VoidSale({ saleId, number, language }: { saleId: number; number: string; language: Language }) {
  const t = SALES_COPY[language].void;
  const [state, action, pending] = useActionState(voidSaleAction, initial);
  const [asking, setAsking] = useState(false);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!state.done) return;
    notify({ message: t.done(number), language });
    document.getElementById("sale-status")?.focus();
  }, [state.done, number, language, t]);

  return (
    <form action={action} className="border-t-2 border-ink px-5 pt-4 pb-6 sm:px-8">
      <input type="hidden" name="saleId" value={saleId} />
      {asking ? (
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p className="font-semibold">{t.confirmTitle}</p>
            <p className="mt-0.5 max-w-prose text-sm text-ink-2">{t.confirmText}</p>
          </div>
          <button
            type="button"
            onClick={() => setAsking(false)}
            disabled={pending}
            className="min-h-12 rounded-control px-4 font-semibold text-ink-2 press-quiet enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
          >
            {t.keep}
          </button>
          <button
            ref={confirm}
            type="submit"
            disabled={pending}
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {pending ? t.voiding : t.confirm}
            </span>
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setAsking(true);
              requestAnimationFrame(() => confirm.current?.focus());
            }}
            className="min-h-12 rounded-control px-4 font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink"
          >
            {t.button}
          </button>
        </div>
      )}
      <FaultLine message={pending ? undefined : state.error?.message} className="pt-2" />
    </form>
  );
}
