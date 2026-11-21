"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState, type ReactNode } from "react";
import { DemoStub } from "@/components/demo-doors";
import { Mark } from "@/components/logo";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { signIn } from "@/server/auth-actions";
import { initialFormState } from "@/server/form-state";

/** The sign-in label: tear-off demo stubs on top, the email and password fields below. */
export function LoginLabel() {
  const [state, formAction, pending] = useActionState(signIn, initialFormState);
  // Which control sent the form, so only that one says it's working.
  const [via, setVia] = useState<string | null>(null);

  const busy = pending;
  const error = state.error;
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  return (
    <form
      action={formAction}
      className="sheet w-full max-w-104 overflow-hidden"
      aria-labelledby="login-title"
      aria-busy={busy}
    >
      <Suspense>
        <NextField />
      </Suspense>

      <header className="border-b-2 border-ink px-6 pt-6 pb-4">
        <h1 id="login-title" className="print-display flex items-center gap-3 text-[2.75rem] uppercase">
          <Mark size={48} />
          Stocktake
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">Inventory you can audit</p>
      </header>

      <fieldset disabled={busy} className="border-b-2 border-dashed border-ink">
        <legend className="sr-only">Try the demo</legend>
        <p aria-hidden className="field-name px-6 pt-3">
          Try the demo
        </p>
        <div className="grid grid-cols-2">
          {DEMO_ROLES.map(({ role, label, duty }, index) => (
            <DemoStub
              key={role}
              role={role}
              label={label}
              duty={duty}
              busy={busy && via === role}
              onPress={() => setVia(role)}
              divided={index > 0}
            />
          ))}
        </div>
      </fieldset>

      <Field name="email" label="Email" error={fieldError("email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email}
          aria-invalid={fieldError("email") ? true : undefined}
          aria-describedby={fieldError("email") ? "email-error" : undefined}
          className="field-input"
        />
      </Field>
      <Field name="password" label="Password" error={fieldError("password")} last>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fieldError("password") ? true : undefined}
          aria-describedby={fieldError("password") ? "password-error" : undefined}
          className="field-input"
        />
      </Field>

      {error && !error.field ? (
        <p role="alert" className="bg-stock px-6 py-3 text-sm font-medium">
          {error.message}
        </p>
      ) : null}

      {/* The label's foot band: reverse print, full bleed, closing the sheet. */}
      <button
        type="submit"
        disabled={busy}
        onClick={() => setVia("form")}
        className="group focus-inset flex min-h-14 w-full items-center justify-center border-t-2 border-ink bg-ink font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
          {busy && via === "form" ? "Signing in…" : "Sign in"}
        </span>
      </button>
    </form>
  );
}

/**
 * One boxed field: its name in the top-left corner, the value printed below. A field at
 * fault turns to yellow attention stock and says what's wrong.
 */
function Field({
  name,
  label,
  error,
  last = false,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`px-6 pt-2.5 pb-2 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] ${
        last ? "" : "border-b border-ink"
      } ${error ? "bg-stock" : ""}`}
    >
      <label htmlFor={name} className={`field-name block ${error ? "text-ink" : ""}`}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="pb-1 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Carries `?next=` through the form, so signing in returns to the page that sent you here. */
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}
