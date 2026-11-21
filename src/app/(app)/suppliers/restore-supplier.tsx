"use client";

import { useActionState } from "react";
import { useLabelEditor } from "@/components/label-editor";
import { type ArchiveFormState, setSupplierArchived } from "@/server/supplier-actions";

const initial: ArchiveFormState = {};

/** Puts an archived supplier back on the list. The label prints active again, with focus on Edit. */
export function RestoreSupplier({ supplierId }: { supplierId: number }) {
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(setSupplierArchived, initial);

  return (
    <form action={formAction} aria-busy={pending} onSubmit={() => editor?.returnFocus()} className="shrink-0">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="intent" value="restore" />
      <button
        type="submit"
        disabled={pending}
        data-return-focus
        className="group h-12 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
          Restore supplier
        </span>
      </button>
      {/* The disabled button shows it's working; this says so to a screen reader. */}
      <p role="status" className="sr-only">
        {pending ? "Restoring…" : ""}
      </p>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
