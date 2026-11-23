"use client";

import { ChevronDown } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { notify } from "@/components/toasts";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type OrderFormState, sendBack } from "@/server/order-actions";
import { ORDERS_COPY } from "./copy";

/** A line with stock that came in and hasn't gone back yet. */
export type ReturnableLine = { id: number; name: string; left: number };

const initial: OrderFormState = {};

/**
 * Sends stock back to the supplier against the line it came in on. Folded away under
 * its heading: it's occasional, and the order's own next step comes first.
 */
export function SendBack({
  lines,
  supplier,
  language,
}: {
  lines: ReturnableLine[];
  supplier: string;
  language: Language;
}) {
  const t = ORDERS_COPY[language].sendBack;
  const f = formats(language);
  const [state, formAction, pending] = useActionState(sendBack, initial);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.done) return;
    form.current?.reset();
    notify({ id: `send-back-${state.done.at}`, message: state.done.message, language });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  const error = pending ? undefined : state.error;
  const quantityError = error?.field === "quantity" ? error.message : undefined;

  return (
    <details className="fold group border-t-2 border-ink">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 row-hit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:px-8 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg font-bold">{t.title}</h2>
        <ChevronDown
          aria-hidden
          size={20}
          strokeWidth={2.25}
          className="shrink-0 text-ink-2 transition-transform duration-150 ease-out group-open:rotate-180"
        />
      </summary>
      <form ref={form} action={formAction} aria-busy={pending} noValidate className="pb-4">
        <p className="max-w-prose px-5 text-sm text-ink-2 sm:px-8">{t.help(supplier)}</p>
        <div className="mt-3 grid gap-px border-y border-ink bg-ink sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field name="lineId" label={t.line} language={language}>
            <div className="relative">
              <select {...fieldProps("lineId")} className="field-input cursor-pointer appearance-none pr-8">
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {t.lineOption(line.name, f.count(line.left))}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                size={18}
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2"
              />
            </div>
          </Field>
          <Field name="quantity" label={t.quantity} language={language} error={quantityError}>
            <input
              {...fieldProps("quantity", { error: quantityError })}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="field-input tabular"
            />
          </Field>
          <Field
            name="note"
            label={t.reason}
            language={language}
            optional
            hint={t.reasonHint}
            className="sm:col-span-2"
          >
            <input
              {...fieldProps("note", { hint: true })}
              type="text"
              maxLength={500}
              className="field-input text-base font-normal"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 sm:px-8">
          <div className="min-h-5 min-w-0 basis-full sm:basis-auto sm:flex-1">
            <p role="status" className="text-sm font-medium">
              {pending ? t.busy : null}
            </p>
            <FaultLine message={error && !quantityError ? error.message : undefined} hold={false} />
          </div>
          <button
            type="submit"
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-active:scale-[0.96]">
              {t.submit}
            </span>
          </button>
        </div>
      </form>
    </details>
  );
}
