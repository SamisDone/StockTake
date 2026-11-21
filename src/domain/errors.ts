import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { type Said, isErrorKey, said, sayIn } from "./error-copy";

export type DomainErrorCode =
  "invalid_input" | "not_found" | "forbidden" | "insufficient_stock" | "invalid_state" | "conflict";

/**
 * An expected failure, said so it can be shown to the person in their language. The
 * English is the error's `message`; `in(language)` prints it for a reader.
 */
export class DomainError extends Error {
  readonly said: Said;

  constructor(
    readonly code: DomainErrorCode,
    message: Said,
    /** The input field at fault, for showing the message next to it. */
    readonly field?: string,
  ) {
    super(sayIn("en", message));
    this.name = "DomainError";
    this.said = message;
  }

  in(language: Language) {
    return sayIn(language, this.said);
  }
}

/** Parses domain input, turning a validation failure into an `invalid_input` error. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    // Schemas name an error key as their message; zod's own defaults get a general one.
    const message = isErrorKey(issue.message) ? (said(issue.message) as Said) : said("invalidValue");
    throw new DomainError("invalid_input", message, issue.path.join(".") || undefined);
  }
  return result.data;
}

/** A zod issue's message (an error key) printed in `language`, for actions that run a schema themselves. */
export function issueMessage(message: string, language: Language) {
  return sayIn(language, isErrorKey(message) ? (said(message) as Said) : said("invalidValue"));
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
