"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState, type ReactNode } from "react";
import { DemoStub } from "@/components/demo-doors";
import { FaultLine } from "@/components/fault";
import { LanguageSwitch } from "@/components/language-switch";
import { PasswordInput } from "@/components/password-input";
import { Mark } from "@/components/logo";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { type Copy, LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { signIn } from "@/server/auth-actions";
import { initialFormState } from "@/server/form-state";

/**
 * The sign-in label: tear-off demo stubs on top, the email and password fields below.
 * Prerendered once per language (`/login` and `/bn/login`); proxy.ts serves the reader's.
 */
export function LoginLabel({ language }: { language: Language }) {
  const t = COPY[language];
  const [state, formAction, pending] = useActionState(signIn, initialFormState);
  // Which control sent the form, so only that one says it's working.
  const [via, setVia] = useState<string | null>(null);

  const busy = pending;
  const error = state.error;
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  return (
    <form
      action={formAction}
      lang={LANGUAGE_TAGS[language]}
      className="sheet w-full max-w-104 overflow-hidden"
      aria-labelledby="login-title"
      aria-busy={busy}
    >
      <Suspense>
        <NextField />
      </Suspense>

      <header className="border-b-2 border-ink px-6 pt-6 pb-4">
        {/* The wordmark is the way back to the home page. It doesn't prefetch: on Workers an
            unrequested prefetch is a server render paid for nothing. */}
        <h1 id="login-title" lang="en" className="print-display text-[2.75rem] uppercase">
          <Link href="/" prefetch={false} className="inline-flex items-center gap-3 rounded-control">
            <Mark size={48} />
            Stocktake
            <span className="sr-only"> {t.home}</span>
          </Link>
        </h1>
        {/* The wordmark takes the label's width on a phone, so the language sits on the
            tagline's line; the negative margins keep its 44px target from growing the header. */}
        <div className="mt-1.5 flex items-center justify-between gap-4">
          <p className="min-w-0 text-sm text-ink-2">{t.tagline}</p>
          <div className="-my-3 -mr-3">
            <LanguageSwitch language={language} variant="toggle" prerendered />
          </div>
        </div>
      </header>

      <fieldset disabled={busy} className="border-b-2 border-dashed border-ink">
        <legend className="sr-only">{t.tryDemo}</legend>
        {/* What the stubs open: shared data that starts over every night. On a narrow
            label the note drops under the heading instead of crowding it. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-6 pt-3">
          <p aria-hidden className="field-name">
            {t.tryDemo}
          </p>
          <p className="text-xs text-ink-2">{t.startsOver}</p>
        </div>
        <div className="grid grid-cols-2">
          {DEMO_ROLES[language].map(({ role, label, duty }, index) => (
            <DemoStub
              key={role}
              role={role}
              label={label}
              duty={duty}
              busy={busy && via === role}
              onPress={() => setVia(role)}
              language={language}
              divided={index > 0}
            />
          ))}
        </div>
      </fieldset>

      <Field name="email" label={t.email} error={fieldError("email")}>
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
      <Field name="password" label={t.password} error={fieldError("password")} last>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          show={t.show}
          hide={t.hide}
          label={t.showPassword}
          aria-invalid={fieldError("password") ? true : undefined}
          aria-describedby={fieldError("password") ? "password-error password-help" : "password-help"}
          className="field-input"
        />
        <p id="password-help" className="pb-1 text-xs text-ink-3">
          {t.forgot}
        </p>
      </Field>

      <FaultLine
        message={error && !error.field ? error.message : undefined}
        className="border-t border-ink px-6 py-3"
      />

      {/* The label's foot band: reverse print, full bleed, closing the sheet. */}
      <button
        type="submit"
        disabled={busy}
        onClick={() => setVia("form")}
        className="group focus-inset flex min-h-14 w-full items-center justify-center border-t-2 border-ink bg-ink font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2"
      >
        <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
          {busy && via === "form" ? t.signingIn : t.signIn}
        </span>
      </button>
    </form>
  );
}

/**
 * One boxed field: its name in the top-left corner, the value printed below. A field at
 * fault keeps its white stock, gains a fault-red rule down its leading edge, and opens a
 * line saying what's wrong.
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
      } ${error ? "fault-rule" : ""}`}
    >
      <label htmlFor={name} className="field-name block">
        {label}
      </label>
      {children}
      <FaultLine id={`${name}-error`} message={error} className="pb-1" />
    </div>
  );
}

/** Carries `?next=` through the form, so signing in returns to the page that sent you here. */
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

const COPY: Copy<{
  title: string;
  tagline: string;
  tryDemo: string;
  startsOver: string;
  email: string;
  password: string;
  signIn: string;
  signingIn: string;
  home: string;
  show: string;
  hide: string;
  showPassword: string;
  forgot: string;
}> = {
  en: {
    title: "Sign in",
    tagline: "Inventory you can audit",
    tryDemo: "Try the demo",
    startsOver: "Starts over at midnight, Dhaka time",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    home: "(home page)",
    show: "Show",
    hide: "Hide",
    showPassword: "Show password",
    forgot: "Forgot it? An admin can give you a new one on the People page.",
  },
  bn: {
    title: "সাইন ইন",
    tagline: "যে মজুতের হিসাব যাচাই করা যায়",
    tryDemo: "ডেমো দেখুন",
    startsOver: "ঢাকার সময় রাত ১২টায় নতুন করে শুরু হয়",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    signIn: "সাইন ইন",
    signingIn: "সাইন ইন হচ্ছে…",
    home: "(প্রথম পাতা)",
    show: "দেখান",
    hide: "লুকান",
    showPassword: "পাসওয়ার্ড দেখান",
    forgot: "ভুলে গেছেন? “দল” পাতা থেকে একজন অ্যাডমিন আপনাকে নতুন পাসওয়ার্ড দিতে পারেন।",
  },
};

/** The page title in each language. */
export const LOGIN_TITLE: Copy<string> = { en: COPY.en.title, bn: COPY.bn.title };
