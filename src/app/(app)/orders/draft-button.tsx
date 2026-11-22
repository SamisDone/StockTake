"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/form-state";
import { draftFromSuggestions } from "@/server/order-actions";
import type { Language } from "@/lib/i18n";
import { ORDERS_COPY } from "./copy";
import { FaultLine } from "@/components/fault";

const initial: FormState = {};

/**
 * Drafts a suggested order and opens it. The server works the lines out again, so what
 * is drafted is what the forecast says now, not what the page showed.
 */
export function DraftButton({
  supplierId,
  supplierName,
  language,
}: {
  supplierId: number;
  supplierName: string;
  language: Language;
}) {
  const t = ORDERS_COPY[language];
  const [state, formAction, pending] = useActionState(draftFromSuggestions, initial);
  return (
    <form action={formAction} aria-busy={pending}>
      <input type="hidden" name="supplierId" value={supplierId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={t.draftTo(supplierName)}
        className="group h-11 rounded-control bg-ink px-4 text-sm font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-md:w-full"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
          {t.draftOrder}
        </span>
      </button>
      <p role="status" className="sr-only">
        {pending ? t.drafting(supplierName) : ""}
      </p>
      <FaultLine message={pending ? undefined : state.error?.message} className="pt-2" />
    </form>
  );
}
