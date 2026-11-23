"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { type PaymentMethod, paymentMethods } from "@/db/schema";
import { Choice, Choices } from "@/components/choice";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { notify } from "@/components/toasts";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { centsToInput, parseCents } from "@/lib/parse";
import { takePayment } from "@/server/customer-actions";
import type { FieldFormState } from "@/server/supplier-actions";
import { SALES_COPY } from "../sales/copy";
import { CUSTOMERS_COPY } from "./copy";

const initial: FieldFormState = {};

/**
 * Taking a payment against what a customer owes, on their label under the yellow due
 * band. The amount starts at the whole due (the label keys it by the due, so it starts
 * again once a payment lands); the label refreshes with what's left, and a toast
 * confirms it.
 */
export function PaymentForm({
  customerId,
  name,
  dueCents,
  money,
  language,
}: {
  customerId: number;
  name: string;
  dueCents: number;
  money: MoneyPrefs;
  language: Language;
}) {
  const t = CUSTOMERS_COPY[language].pay;
  const methods = SALES_COPY[language].methods;
  const m = moneyFormat(money, language);
  // The form goes or starts again as the label refreshes with what's left, so the toast
  // is raised here, with the answer, rather than from an effect.
  const [state, action, pending] = useActionState(async (previous: FieldFormState, formData: FormData) => {
    const next = await takePayment(previous, formData);
    if (next.saved) {
      notify({ message: t.done(m.money(parseCents(String(formData.get("amount") ?? "")) ?? 0), name), language });
      requestAnimationFrame(() => document.getElementById("customer-status")?.focus());
    }
    return next;
  }, initial);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(centsToInput(dueCents));
  const errors = state.fields ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  return (
    <form ref={formRef} action={action} noValidate aria-busy={pending} className="border-b-2 border-ink">
      <input type="hidden" name="customerId" value={customerId} />
      <h2 className="sr-only">{t.title}</h2>
      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">{t.title}</legend>
        <div className="grid sm:grid-cols-2">
          <Field
            name="amount"
            label={t.amount}
            language={language}
            error={errors.amount}
            hint={m.hint(parseCents(amount) ?? 0) ?? t.amountHint(m.money(dueCents))}
            className="border-ink max-sm:border-b sm:border-r"
          >
            <input
              {...fieldProps("amount", { error: errors.amount, hint: true })}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="field-input tabular"
            />
          </Field>
          <Choices legend={t.method} className="border-b-0">
            {paymentMethods.map((value) => (
              <Choice
                key={value}
                name="method"
                value={value}
                checked={method === value}
                onSelect={() => setMethod(value)}
              >
                {methods[value]}
              </Choice>
            ))}
          </Choices>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 border-t border-ink px-5 pt-3 pb-4 sm:px-8">
          <div className="min-h-5 min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p role="status" className="text-sm font-medium">
              {pending ? t.saving : null}
            </p>
            <FaultLine message={pending ? undefined : (state.error?.message ?? errors.method)} hold={false} />
          </div>
          <button
            type="submit"
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {t.submit}
            </span>
          </button>
        </div>
      </fieldset>
    </form>
  );
}
