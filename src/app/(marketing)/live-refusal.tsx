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
 * The hero's slip: a write the database refuses, live. The visitor edits the number in
 * the first statement and runs it; the statement lights, the rule under it drains while
 * it's "sent", the answer is stamped on, and the number snaps back to what's on hand.
 *
 * Left alone for a few seconds it plays all six statements in turn, typing each one in.
 * Pointing at it pauses; focusing or touching it hands it over for good. Nothing reaches
 * a database: the answers are the verified ones in `src/lib/refusals.ts`.
 *
 * Prerendered answered (#1 refused) so the proof is there before any script, and the
 * card's size is held to its longest statement and answer so playing never moves the page.
 */

type Phase = "ready" | "typing" | "highlight" | "executing" | "answered" | "clearing";

const IDLE_MS = 4000;
const TYPE_MS = 18;
const HOLD_MS = 2500;
const BEAT_MS = 300; // the pause between a statement typed and it being run

export function LiveRefusal({ language }: { language: Language }) {
  const t = COPY[language];
  const f = formats(language);
  const reduced = useReducedMotion();
  const onHand = String(ON_HAND_STATEMENT.onHand);

  const [mode, setMode] = useState<"interactive" | "playback">("interactive");
  const [phase, setPhase] = useState<Phase>("answered");
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [value, setValue] = useState(ON_HAND_STATEMENT.value);
  const [snapped, setSnapped] = useState(false);
  const [hint, setHint] = useState<"number" | "same" | null>(null);
  const [runId, setRunId] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [hovered, setHovered] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const card = useRef<HTMLElement>(null);
  const field = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const handedOver = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  // Start playing on its own once nobody has touched it for a while.
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => {
      if (handedOver.current) return;
      setMode("playback");
      setTyped(REFUSALS[0].sql.length);
      setPhase("clearing"); // close #1's answer, then type #2
    }, IDLE_MS);
    return () => clearTimeout(id);
  }, [reduced]);

  // Pause while it's off screen or the tab is hidden: nobody is watching.
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(element);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => clearTimers, []);

  // The playback, one step per render: type a character, light the statement, send it,
  // stamp the answer, hold it, clear it, move on.
  const paused = hovered || offscreen || hidden;
  useEffect(() => {
    if (mode !== "playback" || paused || reduced) return;
    const sql = REFUSALS[index].sql;
    const element = card.current;
    let ms: number;
    let next: () => void;
    switch (phase) {
      case "typing":
        if (typed < sql.length) {
          ms = TYPE_MS;
          next = () => setTyped(typed + 1);
        } else {
          ms = BEAT_MS;
          next = () => setPhase("highlight");
        }
        break;
      case "highlight":
        ms = stageMs(element, "--dur-press");
        next = () => setPhase("executing");
        break;
      case "executing":
        ms = stageMs(element, "--dur-execute");
        next = () => {
          setRunId((id) => id + 1);
          setPhase("answered");
        };
        break;
      case "answered":
        ms = HOLD_MS;
        next = () => setPhase("clearing");
        break;
      case "clearing":
        ms = stageMs(element, "--dur-tear") + BEAT_MS;
        next = () => {
          setIndex((index + 1) % REFUSALS.length);
          setTyped(0);
          setPhase("typing");
        };
        break;
      default:
        return;
    }
    const id = window.setTimeout(next, ms);
    return () => clearTimeout(id);
  }, [mode, phase, index, typed, paused, reduced]);

  /** The visitor reached for the card: stop playing for good and give them the statement. */
  const handOver = (focusField: boolean) => {
    if (handedOver.current) return;
    handedOver.current = true;
    setHovered(false);
    if (mode === "playback") {
      setMode("interactive");
      setPhase("ready");
      setIndex(0);
      setTyped(0);
      setValue(ON_HAND_STATEMENT.value);
      setSnapped(false);
      if (focusField) requestAnimationFrame(() => input.current?.focus());
    }
  };

  /** Says it again even when it's the same words as last time. */
  const announce = (words: string) => setAnnouncement((last) => (last === words ? `${words}\u00a0` : words));

  const run = (event: FormEvent) => {
    event.preventDefault();
    handOver(false);
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
    const said = `${REFUSALS[0].refusal}. ${t.refused} ${t.stillOnHand(f.count(ON_HAND_STATEMENT.onHand))}`;
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

  const playing = mode === "playback";
  const shown = REFUSALS[playing ? index : 0];
  const open = phase === "answered";
  const sql = shown.sql;

  let caption: string;
  if (phase === "executing" || phase === "highlight") caption = t.sending;
  else if (playing && phase === "typing") caption = shown.attempt[language];
  else if (open) {
    caption = playing
      ? t.attemptRefused(shown.attempt[language])
      : snapped
        ? `${t.refused} ${t.stillOnHand(f.count(ON_HAND_STATEMENT.onHand))}`
        : t.refused;
  } else caption = playing ? shown.attempt[language] : t.ready;

  return (
    <figure
      ref={card}
      aria-labelledby="slip-caption"
      className="hero-card receipt torn"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !handedOver.current) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(event) => handOver(!(event.target as Element).closest("button, input"))}
      onFocus={() => handOver(false)}
    >
      <form onSubmit={run} noValidate>
        <div
          data-lit={phase === "highlight" || undefined}
          className="statement-zone px-6 pt-2 pb-4 transition-[background-color] duration-(--dur-press) ease-out data-lit:bg-liner"
        >
          <div className="flex min-h-11 items-center justify-between gap-3">
            <p className="field-name">
              {t.attempted}
              {playing ? (
                <span className="ml-2 font-mono font-normal text-ink-3">
                  {t.playing(f.count(index + 1), f.count(REFUSALS.length))}
                </span>
              ) : null}
            </p>
            <button
              type="submit"
              className="press-quiet -mr-3 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner sm:min-h-9"
            >
              {t.run}
              <CornerDownLeft aria-hidden size={16} strokeWidth={2.25} />
            </button>
          </div>

          {/* Every statement sits in one cell, invisible, so the zone is always as tall as
              the longest and nothing below moves while they play. */}
          <div lang="en" className="grid grid-cols-[minmax(0,1fr)] font-mono text-sm leading-relaxed">
            {REFUSALS.map((refusal) => (
              <p
                key={refusal.sql}
                aria-hidden
                className="invisible col-start-1 row-start-1 break-words whitespace-pre-wrap"
              >
                {refusal.sql}
              </p>
            ))}
            {playing ? (
              <p aria-hidden className="col-start-1 row-start-1 break-words whitespace-pre-wrap">
                <span>{sql.slice(0, typed)}</span>
                {phase === "typing" ? <span className="type-caret" /> : null}
                <span className="invisible">{sql.slice(typed)}</span>
              </p>
            ) : (
              <p className="col-start-1 row-start-1 break-words whitespace-pre-wrap">
                <label htmlFor="hero-value" className="sr-only">
                  {t.inputLabel}
                </label>
                {ON_HAND_STATEMENT.before}
                <span ref={field} className="inline-block">
                  <input
                    ref={input}
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
            )}
          </div>
        </div>
      </form>

      {/* The rule between statement and answer, which drains while the statement is sent. */}
      <div aria-hidden className="h-0.5 bg-liner-deep">
        <div key={runId} data-run={phase === "executing" || undefined} className="execute-bar h-full bg-ink" />
      </div>

      <div className="px-6 pt-3 pb-5">
        <p className="field-name">{open ? t.answered : t.willAnswer}</p>
        <div lang="en" className="mt-2 grid grid-cols-[minmax(0,1fr)]">
          {REFUSALS.map((refusal) => (
            <div key={refusal.sql} aria-hidden className="invisible col-start-1 row-start-1 py-1">
              <p className="refusal-stamp max-w-[calc(100%-1rem)] px-2.5 py-1.5 font-mono text-sm leading-snug font-semibold [overflow-wrap:anywhere] sm:text-base">
                {refusal.refusal}
              </p>
            </div>
          ))}
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
                  {shown.refusal}
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
