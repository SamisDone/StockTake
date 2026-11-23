"use client";

import { Archive } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { useLabelEditor } from "@/components/label-editor";
import { useDiscardGuard } from "@/components/discard-guard";
import { notify } from "@/components/toasts";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import {
  type ArchiveFormState,
  type FieldFormState,
  saveSupplier,
  setSupplierArchived,
} from "@/server/supplier-actions";
import { SUPPLIERS_COPY, type SuppliersCopy } from "./copy";

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
  language,
  defaults,
  action,
  archive,
}: {
  /** Set when editing. Without it the form adds a supplier. */
  supplierId?: number;
  language: Language;
  defaults: SupplierValues;
  /** The way out, top right. */
  action: ReactNode;
  archive?: { supplierId: number; name: string; products: number };
}) {
  const editing = supplierId !== undefined;
  const copy = SUPPLIERS_COPY[language];
  const t = copy.form;
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(saveSupplier, initial);
  const values = (state.values as SupplierValues | undefined) ?? defaults;
  const errors = state.fields ?? {};

  // A refused entry takes focus to the first field at fault, which is described by its message.
  const formRef = useRef<HTMLFormElement>(null);
  const discard = useDiscardGuard(formRef, language);
  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  useEffect(() => {
    if (state.saved && editing) editor?.close(t.saved);
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
            discard.ask(() => editor.close());
          }
        }}
      >
        {editing ? <input type="hidden" name="supplierId" value={supplierId} /> : null}
        <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <h1 id="supplier-title" className="print-display text-2xl sm:text-3xl">
              {editing ? t.editTitle : t.newTitle}
            </h1>
            <p className="mt-1 max-w-prose text-sm text-ink-2">{editing ? t.editHelp : t.newHelp}</p>
          </div>
          {action}
        </header>

        <fieldset disabled={pending} className="min-w-0">
          <legend className="sr-only">{editing ? t.editLegend : t.newLegend}</legend>
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
                maxLength={254}
                autoComplete="off"
                spellCheck={false}
                className="field-input"
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
              name="leadTimeDays"
              label={t.leadTime}
              language={language}
              error={errors.leadTimeDays}
              hint={t.leadTimeHint}
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
                <span aria-hidden className="text-lg font-medium text-ink-3">
                  {t.days}
                </span>
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            {/* Holds a line beside the buttons for "Saving…" and then for a refusal, so
                neither moves the button that was just pressed. */}
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

      {archive ? <ArchiveZone facts={archive} f={formats(language)} t={copy} /> : null}
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
function ArchiveZone({
  facts,
  f,
  t,
}: {
  facts: { supplierId: number; name: string; products: number };
  f: Formats;
  t: SuppliersCopy;
}) {
  const a = t.archive;
  const editor = useLabelEditor();
  // The form goes as the label refreshes archived, so the toast is raised here, with the answer.
  const [state, formAction, pending] = useActionState(async (previous: ArchiveFormState, formData: FormData) => {
    const next = await setSupplierArchived(previous, formData);
    if (next.done) {
      notify({
        message: a.done(facts.name),
        language: f.language,
        undo: async () => {
          const again = new FormData();
          again.set("supplierId", String(facts.supplierId));
          again.set("intent", "restore");
          const answer = await setSupplierArchived({}, again);
          return answer.done
            ? { ok: true, message: a.restored(facts.name) }
            : { ok: false, message: answer.error?.message ?? "" };
        },
      });
    }
    return next;
  }, archiveInitial);

  return (
    <section aria-labelledby="archive-title" className="border-t-2 border-ink">
      <form action={formAction} aria-busy={pending} onSubmit={() => editor?.returnFocus()}>
        <input type="hidden" name="supplierId" value={facts.supplierId} />
        <input type="hidden" name="intent" value="archive" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 pb-5 sm:px-8">
          <div className="min-w-0 flex-1 basis-80">
            <h2 id="archive-title" className="text-lg font-bold">
              {a.title}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              {a.text(facts.name)}
              {facts.products > 0 ? a.products(facts.products, f.count(facts.products)) : null}
            </p>
            {/* Holds its line while empty, so nothing moves when it speaks or refuses. */}
            <div className="mt-1 min-h-5">
              <p role="status" className="text-sm font-medium">
                {pending ? a.archiving : null}
              </p>
              <FaultLine message={pending ? undefined : state.error?.message} hold={false} />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="group flex min-h-12 shrink-0 items-center gap-2 rounded-control px-4 font-semibold text-ink-2 transition-colors duration-150 enabled:hover:bg-liner enabled:hover:text-ink disabled:cursor-progress max-sm:w-full max-sm:justify-center"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              <Archive aria-hidden size={18} strokeWidth={2.25} />
              {a.button}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
