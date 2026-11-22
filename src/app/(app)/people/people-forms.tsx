"use client";

import { useActionState, useEffect, useState } from "react";
import { Choice } from "@/components/choice";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { PillRow } from "@/components/pill-row";
import { notify } from "@/components/toasts";
import type { Role } from "@/db/schema";
import type { Language } from "@/lib/i18n";
import {
  type AddPersonState,
  type Handover,
  type PasswordState,
  type PersonState,
  addPersonAction,
  changeMyPassword,
  changePerson,
} from "@/server/people-actions";
import { PEOPLE_COPY } from "./copy";

/**
 * A temporary password to hand over, printed once on yellow attention stock: the one
 * thing on the page the admin must act on before moving on. Done takes it away.
 */
function HandoverBand({ handover, language, onDone }: { handover: Handover; language: Language; onDone: () => void }) {
  const t = PEOPLE_COPY[language];
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="print-in bg-stock px-5 py-4 sm:px-8">
      <p className="text-sm font-semibold">{t.handover(handover.name)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Printed in the mono face so it's copied right: every character is told apart. */}
        <code lang="en" className="font-mono text-xl font-semibold tracking-wide select-all">
          {handover.password}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(handover.password);
            setCopied(true);
          }}
          className="press-quiet grid min-h-11 rounded-control px-3 text-sm font-semibold hover:bg-ink/10"
        >
          <span aria-hidden={copied} className={`col-start-1 row-start-1 self-center ${copied ? "invisible" : ""}`}>
            {t.copy}
          </span>
          <span aria-hidden={!copied} className={`col-start-1 row-start-1 self-center ${copied ? "" : "invisible"}`}>
            {t.copied}
          </span>
        </button>
        <button
          type="button"
          onClick={onDone}
          className="press-quiet min-h-11 rounded-control px-3 text-sm font-semibold hover:bg-ink/10"
        >
          {t.done}
        </button>
      </div>
      <p className="mt-1 max-w-prose text-sm">{t.handoverHelp}</p>
    </div>
  );
}

/**
 * An admin's actions on one person: switch their role, or reset their password (asked
 * first, since it signs them out). A reset prints the handover band under the row.
 */
export function PersonActions({
  personId,
  name,
  role,
  language,
}: {
  personId: number;
  name: string;
  role: Role;
  language: Language;
}) {
  const t = PEOPLE_COPY[language];
  const [state, formAction, pending] = useActionState(changePerson, {} as PersonState);
  const [intent, setIntent] = useState<"role" | "reset" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [handover, setHandover] = useState<Handover | null>(null);

  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    setConfirming(false);
    if (state.reset) setHandover(state.reset);
  }
  useEffect(() => {
    if (state.done) notify({ id: `person-${state.done.at}`, message: state.done.message, language });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  const next: Role = role === "admin" ? "staff" : "admin";

  return (
    <div className="contents">
      <form
        action={formAction}
        aria-busy={pending}
        className="flex flex-wrap items-center justify-end gap-1 max-md:-ml-3 max-md:justify-start"
      >
        <input type="hidden" name="personId" value={personId} />
        {confirming ? (
          <>
            <p className="basis-full pb-1 text-sm font-medium max-md:pl-3 md:text-right">{t.confirmReset(name)}</p>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="press-quiet min-h-11 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
            >
              {t.keep}
            </button>
            <button
              type="submit"
              name="intent"
              value="reset"
              disabled={pending}
              onClick={() => setIntent("reset")}
              className="group min-h-11 rounded-control bg-ink px-3 text-sm font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:bg-ink-2"
            >
              <span className="inline-grid transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {/* Both labels hold the space, so the button keeps its width while it works. */}
                <span className={`col-start-1 row-start-1 ${pending && intent === "reset" ? "invisible" : ""}`}>
                  {t.reset}
                </span>
                <span
                  aria-hidden={!(pending && intent === "reset")}
                  className={`col-start-1 row-start-1 ${pending && intent === "reset" ? "" : "invisible"}`}
                >
                  {t.resetting}
                </span>
              </span>
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="role" value={next} />
            <button
              type="submit"
              name="intent"
              value="role"
              disabled={pending}
              onClick={() => setIntent("role")}
              className="press-quiet grid min-h-11 rounded-control px-3 text-sm font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink"
            >
              {/* Both labels hold the space, so the button keeps its width while it works. */}
              <span
                className={`col-start-1 row-start-1 self-center ${pending && intent === "role" ? "invisible" : ""}`}
              >
                {next === "admin" ? t.makeAdmin : t.makeStaff}
              </span>
              <span
                aria-hidden={!(pending && intent === "role")}
                className={`col-start-1 row-start-1 self-center ${pending && intent === "role" ? "" : "invisible"}`}
              >
                {t.changing}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="press-quiet min-h-11 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
            >
              {t.reset}
            </button>
          </>
        )}
        <FaultLine
          message={pending ? undefined : state.error?.message}
          className="basis-full pt-1 max-md:pl-3 md:justify-end"
        />
      </form>
      {handover ? (
        <div className="col-span-full -mx-5 sm:-mx-8">
          <HandoverBand handover={handover} language={language} onDone={() => setHandover(null)} />
        </div>
      ) : null}
    </div>
  );
}

/** Adds a person; their temporary password prints below in the handover band. */
export function AddPerson({ language }: { language: Language }) {
  const t = PEOPLE_COPY[language];
  const [state, formAction, pending] = useActionState(addPersonAction, {} as AddPersonState);
  const [role, setRole] = useState<Role>("staff");
  const [handover, setHandover] = useState<Handover | null>(null);
  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    if (state.added) {
      setHandover(state.added);
      setRole("staff");
    } else if (state.values?.role === "admin" || state.values?.role === "staff") {
      setRole(state.values.role);
    }
  }
  const error = (name: string) => (state.error?.field === name ? state.error.message : undefined);

  return (
    <section aria-labelledby="add-title" className="border-t-2 border-ink">
      <div className="px-5 pt-5 sm:px-8">
        <h2 id="add-title" className="text-lg font-bold">
          {t.addTitle}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">{t.addHelp}</p>
      </div>
      <form action={formAction} aria-busy={pending} className="mt-3">
        <fieldset disabled={pending}>
          <div className="grid border-y border-ink sm:grid-cols-2">
            <Field name="name" label={t.name} error={error("name")} language={language}>
              <input
                {...fieldProps("name", { error: error("name") })}
                autoComplete="off"
                defaultValue={state.values?.name}
                className="field-input"
              />
            </Field>
            <Field name="email" label={t.email} error={error("email")} divided language={language}>
              <input
                {...fieldProps("email", { error: error("email") })}
                type="email"
                autoComplete="off"
                defaultValue={state.values?.email}
                className="field-input"
              />
            </Field>
          </div>
          <fieldset className="px-5 pt-3 sm:px-8">
            <legend className="field-name">{t.role}</legend>
            <PillRow className="mt-1 flex flex-wrap gap-1">
              {(["staff", "admin"] as const).map((option) => (
                <Choice
                  key={option}
                  name="role"
                  value={option}
                  checked={role === option}
                  onSelect={() => setRole(option)}
                >
                  {t.roles[option]}
                </Choice>
              ))}
            </PillRow>
            <p className="mt-1.5 text-sm text-ink-2">{t.roleHelp[role]}</p>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            <div className="min-h-5 min-w-0 flex-1">
              <p role="status" className="text-sm font-medium">
                {pending ? t.adding : null}
              </p>
              <FaultLine
                message={!pending && state.error && !state.error.field ? state.error.message : undefined}
                hold={false}
              />
            </div>
            <button
              type="submit"
              className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
            >
              <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {t.add}
              </span>
            </button>
          </div>
        </fieldset>
      </form>
      {handover ? <HandoverBand handover={handover} language={language} onDone={() => setHandover(null)} /> : null}
    </section>
  );
}

/** The signed-in person's own password, or why a demo account's stays as it is. */
export function YourPassword({ language, demo }: { language: Language; demo: boolean }) {
  const t = PEOPLE_COPY[language];
  const [state, formAction, pending] = useActionState(changeMyPassword, {} as PasswordState);
  const error = (name: string) => (state.error?.field === name ? state.error.message : undefined);
  useEffect(() => {
    if (state.done) notify({ id: `password-${state.done.at}`, message: state.done.message, language });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  return (
    <section aria-labelledby="your-title" className="border-t-2 border-ink pb-8">
      <div className="px-5 pt-5 sm:px-8">
        <h2 id="your-title" className="text-lg font-bold">
          {t.yourTitle}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">{demo ? t.yourDemo : t.yourHelp}</p>
      </div>
      {demo ? null : (
        <form action={formAction} aria-busy={pending} className="mt-3">
          <fieldset disabled={pending}>
            <div className="grid border-y border-ink sm:grid-cols-2">
              <Field name="current" label={t.current} error={error("current")} language={language}>
                <PasswordInput
                  {...fieldProps("current", { error: error("current") })}
                  autoComplete="current-password"
                  show={t.show}
                  hide={t.hide}
                  label={t.showPassword(t.current)}
                  className="field-input"
                />
              </Field>
              <Field name="next" label={t.next} error={error("next")} divided language={language}>
                <PasswordInput
                  {...fieldProps("next", { error: error("next") })}
                  autoComplete="new-password"
                  show={t.show}
                  hide={t.hide}
                  label={t.showPassword(t.next)}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-3 sm:px-8">
              <div className="min-h-5 min-w-0 flex-1">
                <p role="status" className="text-sm font-medium">
                  {pending ? t.changingPassword : null}
                </p>
                <FaultLine
                  message={!pending && state.error && !state.error.field ? state.error.message : undefined}
                  hold={false}
                />
              </div>
              <button
                type="submit"
                className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
              >
                <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                  {t.change}
                </span>
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
