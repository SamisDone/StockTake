"use client";

import { Archive } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { Field, fieldProps } from "@/components/field";
import { useLabelEditor } from "@/components/label-editor";
import { formatCount } from "@/lib/format";
import {
  type ArchiveFormState,
  type FieldFormState,
  saveSupplier,
  setSupplierArchived,
} from "@/server/supplier-actions";

/** A supplier's details as the form holds them: text, exactly as typed. */
export type SupplierValues = { name: string; email: string; phone: string; leadTimeDays: string };

const initial: FieldFormState = {};

/**
 * A supplier's details as boxed fields: a new supplier, or an existing one edited in
 * place on its label. Sent fields come back with every problem at once, each next to
 * its field.
 */
export function SupplierForm({
  supplierId,
  defaults,
  action,
  archive,
}: {
  /** Set when editing. Without it the form adds a supplier. */
  supplierId?: number;
  defaults: SupplierValues;
  /** The way out, top right. */
  action: ReactNode;
  archive?: { supplierId: number; name: string; products: number };
}) {
  const editing = supplierId !== undefined;
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(saveSupplier, initial);
  const values = (state.values as SupplierValues | undefined) ?? defaults;
  const errors = state.fields ?? {};

  // A refused entry takes focus to the first field at fault, which is described by its message.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  useEffect(() => {
    if (state.saved && editing) editor?.close("Saved changes.");
    // Only a new answer means anything here. A new supplier redirects to its label instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        noValidate
        aria-busy={pending}
        onSubmit={() => editor?.returnFocus()}
        onKeyDown={(event) => {
          // While editing, Escape means "stop editing".
          if (editing && event.key === "Escape" && editor) {
            event.preventDefault();
            editor.close();
          }
        }}
      >
        {editing ? <input type="hidden" name="supplierId" value={supplierId} /> : null}
        <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <h1 id="supplier-title" className="text-lg font-bold">
              {editing ? "Edit details" : "New supplier"}
            </h1>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              {editing
                ? "Changes go in the activity log. A new lead time changes the cover and suggestions of every product they supply."
                : "Once it's added, give products this supplier on their labels, and order from it."}
            </p>
          </div>
          {action}
        </header>

        <fieldset disabled={pending} className="min-w-0">
          <legend className="sr-only">{editing ? "Supplier details" : "The new supplier"}</legend>
          <div className="grid grid-cols-2 gap-px border-y-2 border-ink bg-ink">
            <Field name="name" label="Name" error={errors.name} className="col-span-2">
              <input
                {...fieldProps("name", { error: errors.name })}
                defaultValue={values.name}
                maxLength={120}
                autoComplete="off"
                autoFocus
                className="field-input print-display text-3xl leading-tight font-extrabold sm:text-4xl"
              />
            </Field>
            <Field name="email" label="Email" optional error={errors.email} className="max-sm:col-span-2">
              <input
                {...fieldProps("email", { error: errors.email })}
                defaultValue={values.email}
                type="email"
                maxLength={254}
                autoComplete="off"
                spellCheck={false}
                className="field-input"
              />
            </Field>
            <Field name="phone" label="Phone" optional error={errors.phone} className="max-sm:col-span-2">
              <input
                {...fieldProps("phone", { error: errors.phone })}
                defaultValue={values.phone}
                type="tel"
                maxLength={40}
                autoComplete="off"
                className="field-input"
              />
            </Field>
            <Field
              name="leadTimeDays"
              label="Lead time"
              error={errors.leadTimeDays}
              hint="Days from placing an order to it arriving. Cover is measured against it."
              className="col-span-2"
            >
              <div className="flex items-baseline gap-2">
                <input
                  {...fieldProps("leadTimeDays", { error: errors.leadTimeDays, hint: true })}
                  defaultValue={values.leadTimeDays}
                  inputMode="numeric"
                  autoComplete="off"
                  className="field-input w-24"
                />
                <span aria-hidden className={`text-lg font-medium ${errors.leadTimeDays ? "text-ink" : "text-ink-3"}`}>
                  days
                </span>
              </div>
            </Field>
          </div>

          {state.error ? (
            <p role="alert" className="bg-stock px-5 py-3 text-sm font-medium sm:px-8">
              {state.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            <p role="status" className="min-h-5 min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
              {pending ? (editing ? "Saving…" : "Adding…") : null}
            </p>
            {editing ? (
              <button
                type="button"
                onClick={() => editor?.close()}
                className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
            >
              <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {editing ? "Save changes" : "Add supplier"}
              </span>
            </button>
          </div>
        </fieldset>
      </form>

      {archive ? <ArchiveZone facts={archive} /> : null}
    </>
  );
}

const archiveInitial: ArchiveFormState = {};

/**
 * Below the form, apart from it: archiving isn't an edit. It says what it will do
 * before it's done; a refusal (the supplier still has open orders) prints here. Once
 * archived, the refreshed label has no form, so the editor prints the label again,
 * archived and with Restore.
 */
function ArchiveZone({ facts }: { facts: { supplierId: number; name: string; products: number } }) {
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(setSupplierArchived, archiveInitial);

  return (
    <section aria-labelledby="archive-title" className="border-t-2 border-ink">
      <form action={formAction} aria-busy={pending} onSubmit={() => editor?.returnFocus()}>
        <input type="hidden" name="supplierId" value={facts.supplierId} />
        <input type="hidden" name="intent" value="archive" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 pb-5 sm:px-8">
          <div className="min-w-0 flex-1 basis-80">
            <h2 id="archive-title" className="text-lg font-bold">
              Archive
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              Takes {facts.name} off the list and out of new orders. Its orders and reviews stay, and an admin can
              restore it.
              {facts.products > 0
                ? ` Its ${formatCount(facts.products)} ${facts.products === 1 ? "product" : "products"} can't be ordered until then, or until they're given another supplier.`
                : null}
            </p>
            {/* Holds its line while empty, so nothing moves when it speaks. */}
            <p role="status" className="mt-1 min-h-5 text-sm font-medium">
              {pending ? "Archiving…" : null}
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="group flex min-h-12 shrink-0 items-center gap-2 rounded-control px-4 font-semibold text-ink-2 transition-colors duration-150 enabled:hover:bg-liner enabled:hover:text-ink disabled:cursor-progress max-sm:w-full max-sm:justify-center"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              <Archive aria-hidden size={18} strokeWidth={2.25} />
              Archive supplier
            </span>
          </button>
        </div>
        {state.error ? (
          <p role="alert" className="bg-stock px-5 py-3 text-sm font-medium sm:px-8">
            {state.error.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
