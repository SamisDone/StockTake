"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";
import { COMPONENT_COPY } from "@/components/copy";
import { FaultLine } from "@/components/fault";
import { DEMO_ROLES } from "@/lib/demo-roles";
import type { Language } from "@/lib/i18n";
import { signIn } from "@/server/auth-actions";
import { initialFormState } from "@/server/form-state";
import { COPY } from "./copy";

/**
 * The foot of the landing: one ledger line across the page, "Open the demo as → Admin |
 * Staff", each seat with what it does. The same one-click sign-in as the hero's stubs,
 * set large; under the pointer a door's paper wipes in from the left and its arrow steps
 * forward.
 */
export function AccessRow({ language }: { language: Language }) {
  const t = COPY[language];
  const [state, formAction, pending] = useActionState(signIn, initialFormState);
  const [via, setVia] = useState<string | null>(null);
  const words = t.openAs.split(" ");
  const last = words.pop();
  const lead = words.join(" ");

  return (
    <form action={formAction} aria-busy={pending} className="mt-8 border-y border-ink">
      <fieldset
        disabled={pending}
        className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch"
      >
        <legend className="sr-only">{t.openAs}</legend>
        {/* "Open the demo as →" reads into the doors' names: on a wide screen it sits on
            their baseline (an invisible strut the size of a name sets the line), on a phone
            it heads the column and the arrow turns down toward them. */}
        <p
          aria-hidden
          className="print-display py-5 text-3xl text-ink-2 sm:text-4xl lg:self-start lg:py-8 lg:pr-6 lg:text-3xl xl:text-4xl"
        >
          <span className="invisible hidden w-0 text-6xl lg:inline-block">A</span>
          {/* The arrow keeps to its last word, never wrapping onto a line of its own. */}
          {lead}{" "}
          <span className="whitespace-nowrap">
            {last}
            <ArrowRight size={28} strokeWidth={3} className="ml-3 inline-block align-[-0.08em] max-lg:rotate-90" />
          </span>
        </p>
        {DEMO_ROLES[language].map(({ role, label }) => {
          const busy = pending && via === role;
          return (
            <button
              key={role}
              type="submit"
              name="demo"
              value={role}
              formNoValidate
              onClick={() => setVia(role)}
              className="wipe wipe-paper group focus-inset flex flex-col items-start gap-2 border-t border-ink px-1 py-5 text-left disabled:cursor-progress lg:border-t-0 lg:border-l lg:border-dashed lg:px-6 lg:py-8"
            >
              <span className="flex w-full items-center justify-between gap-4">
                <span className="print-display inline-block origin-left text-5xl transition-transform duration-(--dur-press) ease-out group-enabled:group-active:scale-[0.96] lg:text-6xl">
                  {label}
                </span>
                <ArrowRight aria-hidden size={36} strokeWidth={3} className="wipe-arrow shrink-0" />
              </span>
              {/* Both lines hold the same cell, so swapping them never changes the door's height. */}
              <span className="grid max-w-sm leading-relaxed text-ink-2">
                <span className={`col-start-1 row-start-1 ${busy ? "invisible" : ""}`}>{t.work[role]}</span>
                <span
                  aria-hidden={!busy}
                  className={`col-start-1 row-start-1 font-semibold text-ink ${busy ? "" : "invisible"}`}
                >
                  {COMPONENT_COPY[language].signingIn}
                </span>
              </span>
            </button>
          );
        })}
      </fieldset>
      <FaultLine message={state.error?.message} className="border-t border-ink py-3" />
    </form>
  );
}
