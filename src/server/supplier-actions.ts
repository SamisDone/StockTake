"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import {
  type SupplierInput,
  archiveSupplier,
  createSupplier,
  deleteReview,
  restoreSupplier,
  reviewSupplier,
  supplierInput,
  updateSupplier,
} from "@/domain/suppliers";
import { parseUnits } from "@/lib/parse";
import { authorize } from "./dal";
import { type FormState, field, formError } from "./form-state";

/** What a form with boxed fields gets back: a message per field at fault, what was typed, or what it saved. */
export type FieldFormState = {
  fields?: Record<string, string>;
  error?: { message: string };
  values?: Record<string, string>;
  /** Set after a successful save. `at` changes on every save. */
  saved?: { id: number; at: number };
};

const positiveId = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const SUPPLIER_FIELDS = ["name", "email", "phone", "leadTimeDays"] as const;

/**
 * Adds a supplier, or edits one when the form carries its ID. Admin-only; the domain
 * checks. Every problem comes back at once, each next to its field. A new supplier
 * opens on its own label.
 */
export async function saveSupplier(_previous: FieldFormState, formData: FormData): Promise<FieldFormState> {
  const { db, user } = await authorize();
  const values = Object.fromEntries(SUPPLIER_FIELDS.map((name) => [name, field(formData, name)])) as Record<
    (typeof SUPPLIER_FIELDS)[number],
    string
  >;
  const idText = field(formData, "supplierId");
  const supplierId = idText ? positiveId(idText) : null;
  if (idText && supplierId === null) return { error: { message: "That supplier doesn't exist." }, values };

  const fields: Record<string, string> = {};
  const leadTimeDays = parseUnits(values.leadTimeDays);
  if (leadTimeDays === null) fields.leadTimeDays = "Enter a whole number of days, 0 or more.";

  const input: SupplierInput = {
    name: values.name,
    email: values.email,
    phone: values.phone,
    leadTimeDays: leadTimeDays ?? 0,
  };
  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
  }
  if (Object.keys(fields).length > 0) return { fields, values };

  let id: number;
  try {
    if (supplierId === null) {
      ({ id } = await createSupplier(db, user, input));
    } else {
      await updateSupplier(db, user, supplierId, input);
      id = supplierId;
    }
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field
      ? { fields: { [error.field]: error.message }, values }
      : { error: { message: error.message }, values };
  }

  if (supplierId === null) redirect(`/suppliers/${id}`);
  refresh();
  return { saved: { id, at: Date.now() } };
}

/** What the archive and restore forms get back. */
export type ArchiveFormState = FormState & {
  /** Set after a successful archive or restore. `at` changes every time. */
  done?: { archived: boolean; at: number };
};

/** Archives a supplier (`intent=archive`) or restores it (`intent=restore`). Admin-only. */
export async function setSupplierArchived(_previous: ArchiveFormState, formData: FormData): Promise<ArchiveFormState> {
  const { db, user } = await authorize();
  const supplierId = positiveId(field(formData, "supplierId"));
  const archive = field(formData, "intent") === "archive";
  if (supplierId === null) return { error: { message: "That supplier doesn't exist." } };

  try {
    await (archive ? archiveSupplier : restoreSupplier)(db, user, supplierId);
  } catch (error) {
    return formError(error);
  }

  refresh();
  return { done: { archived: archive, at: Date.now() } };
}

/** What the review form gets back. */
export type ReviewFormState = FieldFormState & {
  /** Set after the review is saved or removed. `at` changes every time. */
  done?: { message: string; at: number };
};

/** Rates a supplier as the signed-in person, replacing their earlier review. Anyone can. */
export async function saveReview(_previous: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const { db, user } = await authorize();
  const supplierId = positiveId(field(formData, "supplierId"));
  const values = { rating: field(formData, "rating"), comment: field(formData, "comment") };
  if (supplierId === null) return { error: { message: "That supplier doesn't exist." }, values };

  const rating = Number(values.rating);
  if (!/^[1-5]$/.test(values.rating)) return { fields: { rating: "Choose 1 to 5 stars." }, values };

  try {
    await reviewSupplier(db, user, supplierId, { rating, comment: values.comment });
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field
      ? { fields: { [error.field]: error.message }, values }
      : { error: { message: error.message }, values };
  }

  refresh();
  return { done: { message: "Saved your review.", at: Date.now() } };
}

/** Removes the signed-in person's own review. */
export async function removeReview(_previous: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const { db, user } = await authorize();
  const supplierId = positiveId(field(formData, "supplierId"));
  if (supplierId === null) return { error: { message: "That supplier doesn't exist." } };
  await deleteReview(db, user, supplierId);
  refresh();
  return { done: { message: "Removed your review.", at: Date.now() } };
}
