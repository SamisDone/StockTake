"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/form-state";
import { draftFromSuggestions } from "@/server/order-actions";

const initial: FormState = {};

/**
 * Drafts a suggested order and opens it. The server works the lines out again, so what
 * is drafted is what the forecast says now, not what the page showed.
 */
export function DraftButton({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const [state, formAction, pending] = useActionState(draftFromSuggestions, initial);
  return (
    <form action={formAction} aria-busy={pending}>
      <input type="hidden" name="supplierId" value={supplierId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Draft an order to ${supplierName}`}
        className="group h-11 rounded-control bg-ink px-4 text-sm font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-md:w-full"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
          Draft order
        </span>
      </button>
      <p role="status" className="sr-only">
        {pending ? `Drafting an order to ${supplierName}…` : ""}
      </p>
      {state.error ? (
        <p role="alert" className="mt-2 bg-stock px-2 py-1 text-sm font-medium">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
