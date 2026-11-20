import { DomainError } from "@/domain/errors";

/**
 * What a form's Server Action returns to `useActionState`. React resets an action form
 * after it submits, so `values` hands back what the person typed when it failed.
 */
export type FormState = {
  error?: { message: string; field?: string };
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

/**
 * Turns an expected domain failure into form state. Anything else (a bug, an outage,
 * or a redirect) is rethrown for Next.js to handle.
 */
export function formError(error: unknown, values?: FormState["values"]): FormState {
  if (error instanceof DomainError) return { error: { message: error.message, field: error.field }, values };
  throw error;
}

/** A form field as a string: missing fields and file uploads become "". */
export function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
