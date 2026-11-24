"use client";

import { CornerDownLeft } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FaultText } from "@/components/fault";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { ON_HAND_STATEMENT, REFUSALS } from "@/lib/refusals";
import { COPY } from "./copy";
import { stageMs, useReducedMotion } from "./stage";

/**
 * The hero's slip: a write the database refuses, live. It says what the write tries in
 * plain words first, then the statement. The visitor edits the number in it and runs it;
 * the statement lights, the rule under it drains while it's "sent", the answer is stamped
 * on, and the number snaps back to what's on hand. Nothing reaches a database: the answer
 * is the verified one in `src/lib/refusals.ts`.
 *
 * It waits for the visitor and never plays by itself: the six statements are listed in
 * full just below ("Try to break it"). Prerendered answered, so the proof is there before
 * any script, with an invitation to try another number.
 */

type Phase = "ready" | "highlight" | "executing" | "answered";

const STATEMENT = REFUSALS[0];

export function LiveRefusal({ language }: { language: Language }) {
  const t = COPY[language];
  const f = formats(language);
  const reduced = useReducedMotion();
  const onHand = String(ON_HAND_STATEMENT.onHand);

  const [phase, setPhase] = useState<Phase>("answered");
  const [value, setValue] = useState(ON_HAND_STATEMENT.value);
  const [snapped, setSnapped] = useState(false);
  const [hint, setHint] = useState<"number" | "same" | null>(null);
  const [runId, setRunId] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const card = useRef<HTMLElement>(null);
  const field = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  useEffect(() => clearTimers, []);

  /** Says it again even when it's the same words as last time. */
  const announce = (words: string) => setAnnouncement((last) => (last === words ? `${words} ` : words));

  const run = (event: FormEvent) => {
    event.preventDefault();
    clearTimers();
    if (!/^\d+$/.test(value)) {
      setHint("number");
      announce(t.hintNumber);
      return;
    }
    if (Number(value) === ON_HAND_STATEMENT.onHand) {
      setHint("same");
      announce(t.hintSame(f.count(ON_HAND_STATEMENT.onHand)));
      return;
    }
    setHint(null);
    setSnapped(false);
    const said = `${STATEMENT.refusal}. ${t.refused} ${t.stillOnHand(f.count(ON_HAND_STATEMENT.onHand))}`;
    const answer = () => {
      setRunId((id) => id + 1);
      setPhase("answered");
      announce(said);
    };

    if (reduced) {
      answer();
      setValue(onHand);
      setSnapped(true);
      return;
    }
    const element = card.current;
    const press = stageMs(element, "--dur-press");
    const execute = stageMs(element, "--dur-execute");
    const impact = stageMs(element, "--dur-impact");
    setPhase("highlight");
    later(() => setPhase("executing"), press);
    later(answer, press + execute);
    later(
      () => {
        setValue(onHand);
        setSnapped(true);
        field.current?.animate(
          [0, -4, 4, -4, 4, -4, 4, 0].map((x) => ({ translate: `${x}px 0` })),
          { duration: stageMs(element, "--dur-shake"), easing: "linear" },
        );
      },
      press + execute + impact,
    );
  };

  const edit = (next: string) => {
    // Bangla digits typed on a Bangla keyboard go into the SQL as the digits SQL reads.
    setValue(next.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))));
    setHint(null);
    setSnapped(false);
    if (phase === "answered") setPhase("ready");
  };

  const open = phase === "answered";
  let caption: string;
  if (phase === "executing" || phase === "highlight") caption = t.sending;
  else if (!open) caption = t.ready;
  else if (runId === 0) caption = t.tryYourOwn(f.count(Number(ON_HAND_STATEMENT.value)));
  else caption = snapped ? `${t.refused} ${t.stillOnHand(f.count(ON_HAND_STATEMENT.onHand))}` : t.refused;

  return (
    <figure ref={card} aria-labelledby="slip-title" className="hero-card receipt torn">
      <form onSubmit={run} noValidate>
        <div
          data-lit={phase === "highlight" || undefined}
          className="statement-zone px-6 pt-2 pb-4 transition-[background-color] duration-(--dur-press) ease-out data-lit:bg-liner"
        >
          <div className="flex min-h-11 items-center justify-between gap-3">
            <p className="field-name">{t.attempted}</p>
            <button
              type="submit"
              className="press-quiet -mr-3 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner sm:min-h-9"
            >
              {t.run}
              <CornerDownLeft aria-hidden size={16} strokeWidth={2.25} />
            </button>
          </div>

          <p id="slip-title" className="text-lg leading-snug font-bold text-pretty">
            {STATEMENT.attempt[language]}
          </p>
          <p lang="en" className="mt-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
            <label htmlFor="hero-value" className="sr-only">
              {t.inputLabel}
            </label>
            {ON_HAND_STATEMENT.before}
            <span ref={field} className="inline-block">
              <input
                id="hero-value"
                value={value}
                onChange={(event) => edit(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="send"
                maxLength={7}
                aria-invalid={hint ? true : undefined}
                aria-describedby="slip-caption"
                style={{ width: `calc(${Math.max(value.length, 1)}ch + 0.5rem)` }}
                className="statement-input"
              />
            </span>
            {ON_HAND_STATEMENT.after}
          </p>
        </div>
      </form>

      {/* The rule between statement and answer, which drains while the statement is sent. */}
      <div aria-hidden className="h-0.5 bg-liner-deep">
        <div key={runId} data-run={phase === "executing" || undefined} className="execute-bar h-full bg-ink" />
      </div>

      <div className="px-6 pt-3 pb-5">
        <p className="field-name">{open ? t.answered : t.willAnswer}</p>
        {/* The answer's room is held while it's closed, so opening it never moves the page. */}
        <div lang="en" className="mt-2 grid grid-cols-[minmax(0,1fr)]">
          <div aria-hidden className="invisible col-start-1 row-start-1 py-1">
            <p className="refusal-stamp max-w-[calc(100%-1rem)] px-2.5 py-1.5 font-mono text-sm leading-snug font-semibold [overflow-wrap:anywhere] sm:text-base">
              {STATEMENT.refusal}
            </p>
          </div>
          {/* Clipped while it opens; the side room lets the stamp land from a touch larger. */}
          <div className="fault-reveal col-start-1 row-start-1" data-open={open || undefined}>
            <div className="-mx-3 min-h-0 overflow-hidden px-3">
              <div className="py-1">
                <p
                  key={runId}
                  className={`refusal-stamp max-w-[calc(100%-1rem)] px-2.5 py-1.5 font-mono text-sm leading-snug font-semibold [overflow-wrap:anywhere] sm:text-base ${
                    runId > 0 ? "stamp-hit" : ""
                  }`}
                >
                  {STATEMENT.refusal}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <figcaption id="slip-caption" className="border-t border-hairline px-6 py-3 text-sm text-ink-2">
        {hint ? (
          <FaultText>{hint === "number" ? t.hintNumber : t.hintSame(f.count(ON_HAND_STATEMENT.onHand))}</FaultText>
        ) : (
          caption
        )}
      </figcaption>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </figure>
  );
}
