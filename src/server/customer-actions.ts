"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { type PaymentMethod, paymentMethods } from "@/db/schema";
import { type CustomerInput, createCustomer, customerInput, recordPayment, updateCustomer } from "@/domain/customers";
import { DomainError, issueMessage } from "@/domain/errors";
import { parseCents } from "@/lib/parse";
import { ACTION_COPY } from "./action-copy";
import { authorize } from "./dal";
import { field } from "./form-state";
import type { FieldFormState } from "./supplier-actions";

const positiveId = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const CUSTOMER_FIELDS = ["name", "phone", "email", "note"] as const;

/**
 * Adds a customer, or edits one when the form carries its ID. Anyone can. Every problem
 * comes back at once, each next to its field. A new customer opens on their own label.
 */
export async function saveCustomer(_previous: FieldFormState, formData: FormData): Promise<FieldFormState> {
  const { db, user, language } = await authorize();
  const values = Object.fromEntries(CUSTOMER_FIELDS.map((name) => [name, field(formData, name)])) as Record<
    (typeof CUSTOMER_FIELDS)[number],
    string
  >;
  const idText = field(formData, "customerId");
  const customerId = idText ? positiveId(idText) : null;
  if (idText && customerId === null) return { error: { message: ACTION_COPY[language].noCustomer }, values };

  const input: CustomerInput = values;
  const parsed = customerInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issueMessage(issue.message, language);
    return { fields, values };
  }

  let id: number;
  try {
    if (customerId === null) {
      ({ id } = await createCustomer(db, user, input));
    } else {
      await updateCustomer(db, user, customerId, input);
      id = customerId;
    }
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return { error: { message: error.in(language) }, values };
  }
  if (customerId === null) redirect(`/customers/${id}`);
  refresh();
  return { saved: { id, at: Date.now() } };
}

/** Takes a payment against what a customer owes. Anyone can. */
export async function takePayment(_previous: FieldFormState, formData: FormData): Promise<FieldFormState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const values = {
    amount: field(formData, "amount"),
    method: field(formData, "method"),
    note: field(formData, "note"),
  };
  const customerId = positiveId(field(formData, "customerId"));
  if (customerId === null) return { error: { message: t.noCustomer }, values };

  const fields: Record<string, string> = {};
  const amount = parseCents(values.amount);
  if (amount === null || amount === 0) fields.amount = t.enterAmount;
  if (!paymentMethods.includes(values.method as PaymentMethod)) fields.method = t.choosePayment;
  if (amount === null || amount === 0 || Object.keys(fields).length > 0) return { fields, values };

  try {
    await recordPayment(db, user, {
      customerId,
      amountCents: amount,
      method: values.method as PaymentMethod,
      note: values.note,
    });
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field
      ? { fields: { [error.field]: error.in(language) }, values }
      : { error: { message: error.in(language) }, values };
  }
  refresh();
  return { saved: { id: customerId, at: Date.now() } };
}
