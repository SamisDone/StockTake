import { z } from "zod";

export type DomainErrorCode =
  "invalid_input" | "not_found" | "forbidden" | "insufficient_stock" | "invalid_state" | "conflict";

/** An expected failure with a message that can be shown to the person as-is. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    /** The input field at fault, for showing the message next to it. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Parses domain input, turning a validation failure into an `invalid_input` error. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DomainError("invalid_input", issue.message, issue.path.join(".") || undefined);
  }
  return result.data;
}

/** Collects the messages along an error's `cause` chain (Drizzle wraps driver errors). */
function messages(error: unknown): string {
  const parts: string[] = [];
  for (let e = error; e instanceof Error && parts.length < 5; e = e.cause) parts.push(e.message);
  return parts.join(" | ");
}

/** True when the error is the database rejecting a write by the named constraint or trigger message. */
export function violates(error: unknown, rule: string | RegExp): boolean {
  const text = messages(error);
  return typeof rule === "string" ? text.includes(rule) : rule.test(text);
}
