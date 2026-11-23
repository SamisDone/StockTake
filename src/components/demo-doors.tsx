"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";
import { signIn } from "@/server/auth-actions";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { initialFormState } from "@/server/form-state";
import type { Language } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";
import { FaultLine } from "./fault";

/**
 * One tear-off stub: submits its form as that demo account. Used inside the login label
 * and on its own, wherever the demo can be opened.
 */
export function DemoStub({
  role,
  label,
  duty,
  busy,
  onPress,
  language,
  divided = false,
  receipt = false,
}: {
  role: string;
  label: string;
  duty: string;
  busy: boolean;
  language: Language;
  onPress: () => void;
  divided?: boolean;
  /** On the landing's receipt paper: a perforated divider between the stubs. */
  receipt?: boolean;
}) {
  return (
    <button
      type="submit"
      name="demo"
      value={role}
      formNoValidate
      onClick={onPress}
      className={`group focus-inset flex min-h-28 min-w-0 flex-col items-start gap-1 pt-2 pb-5 text-left transition-[background-color] duration-150 ${
        receipt ? "px-4 sm:px-6" : "px-6"
      } ${
        divided ? `border-l border-ink ${receipt ? "border-dashed" : ""}` : ""
      } enabled:hover:bg-liner disabled:cursor-progress`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span
          className={`print-display inline-block origin-left transition-transform ${
            receipt ? "text-[clamp(1.5rem,7vw,1.875rem)]" : "text-3xl"
          } duration-150 ease-out group-enabled:group-active:scale-[0.96]`}
        >
          {label}
        </span>
        <ArrowRight
          aria-hidden
          size={22}
          strokeWidth={3.5}
          className="shrink-0 transition-transform duration-150 ease-out group-enabled:group-hover:translate-x-0.5"
        />
      </span>
      {/* Both lines hold the same cell, so swapping them never changes the stub's height. */}
      <span className="grid text-sm leading-snug text-ink-2">
        <span className={`col-start-1 row-start-1 ${busy ? "invisible" : ""}`}>{duty}</span>
        <span
          aria-hidden={!busy}
          className={`col-start-1 row-start-1 font-semibold text-ink ${busy ? "" : "invisible"}`}
        >
          {COMPONENT_COPY[language].signingIn}
        </span>
      </span>
    </button>
  );
}

/** The two demo accounts as a small label of their own: one click opens the app. */
export function DemoDoors({
  language,
  name,
  receipt = false,
}: {
  language: Language;
  name?: string;
  /** Printed on the landing's receipt paper (landing.css) instead of a label sheet. */
  receipt?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signIn, initialFormState);
  const [via, setVia] = useState<string | null>(null);

  return (
    <form action={formAction} className={receipt ? "receipt torn" : "sheet overflow-hidden"} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend className="field-name px-6 pt-3">{name ?? COMPONENT_COPY[language].openDemo}</legend>
        <div className="grid grid-cols-2">
          {DEMO_ROLES[language].map(({ role, label, duty }, index) => (
            <DemoStub
              key={role}
              role={role}
              label={label}
              duty={duty}
              busy={pending && via === role}
              onPress={() => setVia(role)}
              language={language}
              divided={index > 0}
              receipt={receipt}
            />
          ))}
        </div>
      </fieldset>
      <FaultLine message={state.error?.message} className="border-t border-ink px-6 py-3" />
    </form>
  );
}
