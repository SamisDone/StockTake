"use client";

import { type ReactNode, useActionState, useEffect, useRef } from "react";
import { useDiscardGuard } from "@/components/discard-guard";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { useLabelEditor } from "@/components/label-editor";
import { notify } from "@/components/toasts";
import type { Language } from "@/lib/i18n";
import { saveCustomer } from "@/server/customer-actions";
import type { FieldFormState } from "@/server/supplier-actions";
import { CUSTOMERS_COPY } from "./copy";

/** A customer's details as the form holds them: text, exactly as typed. */
export type CustomerValues = { name: string; phone: string; email: string; note: string };

export const EMPTY_CUSTOMER: CustomerValues = { name: "", phone: "", email: "", note: "" };

const initial: FieldFormState = {};

/**
 * A customer's details as boxed fields: a new customer, or one edited in place on their
 * label. Only the name is needed. Every problem comes back at once, next to its field.
 */
export function CustomerForm({
  customerId,
  language,
  defaults,
  action,
}: {
  /** Set when editing. Without it the form adds a customer. */
  customerId?: number;
  language: Language;
  defaults: CustomerValues;
  action: ReactNode;
}) {
  const editing = customerId !== undefined;
  const t = CUSTOMERS_COPY[language].form;
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(saveCustomer, initial);
  const values = (state.values as CustomerValues | undefined) ?? defaults;
  const errors = state.fields ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const discard = useDiscardGuard(formRef, language);

  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  useEffect(() => {
    if (!state.saved || !editing) return;
    editor?.close(t.saved(values.name));
    notify({ message: t.saved(values.name), language });
    // Only a new answer means anything here. A new customer redirects to their label instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-busy={pending}
      onSubmit={() => editor?.returnFocus()}
      onKeyDown={(event) => {
        if (editing && event.key === "Escape" && editor) {
          event.preventDefault();
          discard.ask(() => editor.close());
        }
      }}
    >
      {editing ? <input type="hidden" name="customerId" value={customerId} /> : null}
      <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="customer-title" className="print-display text-2xl sm:text-3xl">
            {editing ? t.editTitle : t.newTitle}
          </h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{t.help}</p>
        </div>
        {action}
      </header>

      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">{editing ? t.editTitle : t.newTitle}</legend>
        <div className="grid grid-cols-2 gap-px border-y-2 border-ink bg-ink">
          <Field name="name" label={t.name} language={language} error={errors.name} className="col-span-2">
            <input
              {...fieldProps("name", { error: errors.name })}
              defaultValue={values.name}
              maxLength={120}
              autoComplete="off"
              autoFocus
              className="field-input print-display text-3xl leading-tight font-extrabold sm:text-4xl"
            />
          </Field>
          <Field
            name="phone"
            label={t.phone}
            language={language}
            optional
            error={errors.phone}
            className="max-sm:col-span-2"
          >
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
            name="email"
            label={t.email}
            language={language}
            optional
            error={errors.email}
            className="max-sm:col-span-2"
          >
            <input
              {...fieldProps("email", { error: errors.email })}
              defaultValue={values.email}
              type="email"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              className="field-input"
            />
          </Field>
          <Field
            name="note"
            label={t.note}
            language={language}
            optional
            error={errors.note}
            hint={t.noteHint}
            className="col-span-2"
          >
            <textarea
              {...fieldProps("note", { error: errors.note, hint: true })}
              defaultValue={values.note}
              maxLength={500}
              rows={2}
              className="field-input resize-y text-base font-normal"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
          <div className="min-h-5 min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p role="status" className="text-sm font-medium">
              {pending ? (editing ? t.saving : t.adding) : null}
            </p>
            <FaultLine message={pending ? undefined : state.error?.message} hold={false} />
          </div>
          {editing ? (
            <button
              type="button"
              onClick={() => discard.ask(() => editor?.close())}
              className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
            >
              {t.cancel}
            </button>
          ) : null}
          <button
            type="submit"
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {editing ? t.save : t.add}
            </span>
          </button>
        </div>
      </fieldset>
      {discard.dialog}
    </form>
  );
}
