import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";

/**
 * A boxed field on a label: its name small in the top-left, the value below, and a
 * line of help under it. Focus draws a 2px inset rule round the box, not the input. At
 * fault, the box turns to yellow attention stock and the message takes the help's
 * place. Give the input `fieldProps(...)` so it's named, described and flagged to match.
 */
export function Field({
  name,
  label,
  language,
  error,
  hint,
  optional = false,
  divided = false,
  className = "",
  children,
}: {
  name: string;
  label: string;
  language: Language;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  /** A 1px rule on its leading edge, for fields laid side by side without a grid. */
  divided?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`px-5 pt-2.5 pb-1.5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] sm:px-8 ${
        divided ? "border-ink max-sm:border-t sm:border-l" : ""
      } ${error ? "bg-stock" : "bg-label"} ${className}`}
    >
      <label htmlFor={name} className={`field-name block ${error ? "text-ink" : ""}`}>
        {label}
        {optional ? <span className="font-normal"> {COMPONENT_COPY[language].optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="pb-1 text-sm font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="pb-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The input's half of a field: its ID and name, and what describes it (the error, else the help). */
export function fieldProps(name: string, { error, hint }: { error?: string; hint?: boolean } = {}) {
  return {
    id: name,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${name}-error` : hint ? `${name}-hint` : undefined,
  } as const;
}
