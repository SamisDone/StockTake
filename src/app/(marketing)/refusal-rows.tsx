"use client";

import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formats } from "@/lib/format";
import { duration, easing, reducedMotion } from "@/lib/motion";
import type { Language } from "@/lib/i18n";
import { REFUSALS } from "@/lib/refusals";
import { COPY } from "./copy";
import { stageMs, useHydrated, useReducedMotion } from "./stage";

/**
 * "Try to break it": each statement runs once as it scrolls into view (rows arriving
 * together a beat apart): the statement lights, a short rule drains in its answer cell,
 * the cell opens and the database's answer is stamped on. Run again replays a row.
 *
 * On a phone the list shows the first three once the page is live, and the rest behind
 * "Show the other three" (six rows of wrapped SQL are two screens there); the rows it
 * opens run as they come into view like the others.
 *
 * Prerendered with every answer printed, so without script (or with reduced motion) the
 * list reads complete. Once the page is live, rows that haven't run yet are closed until
 * they do. Each answer's space is held from the start, so opening one never moves the page.
 */

type Phase = "idle" | "highlight" | "executing" | "answered";

/** How many rows a phone shows before "Show the other three". */
const SHOWN_ON_PHONE = 3;

export function RefusalRows({ language }: { language: Language }) {
  const t = COPY[language];
  const f = formats(language);
  const hydrated = useHydrated();
  const reduced = useReducedMotion();

  const [phases, setPhases] = useState<Phase[]>(() => REFUSALS.map(() => "answered"));
  const [ran, setRan] = useState<boolean[]>(() => REFUSALS.map(() => false));
  const [runIds, setRunIds] = useState<number[]>(() => REFUSALS.map(() => 0));
  const [announcement, setAnnouncement] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Folded only once the page is live, so without script every row is there.
  const folded = hydrated && !showAll;

  const list = useRef<HTMLOListElement>(null);
  const timers = useRef<Map<number, number[]>>(new Map());
  /** The folded list's height when "Show the other 3" was pressed, to open from. */
  const foldFrom = useRef<number | null>(null);

  // Opening the fold grows the list by height, so what's below moves down with it
  // instead of snapping (under reduced motion it simply opens).
  useLayoutEffect(() => {
    const element = list.current;
    const from = foldFrom.current;
    foldFrom.current = null;
    if (!showAll || !element || from === null || reducedMotion()) return;
    const to = element.offsetHeight;
    if (to <= from) return;
    element.animate(
      [
        { height: `${from}px`, overflow: "hidden" },
        { height: `${to}px`, overflow: "hidden" },
      ],
      { duration: duration("--dur-print", 260), easing: easing("--ease-out") },
    );
  }, [showAll]);

  const at = <T,>(setter: (update: (all: T[]) => T[]) => void, index: number, value: T) =>
    setter((all) => all.map((item, i) => (i === index ? value : item)));

  const clear = (index: number) => {
    timers.current.get(index)?.forEach(clearTimeout);
    timers.current.set(index, []);
  };
  const later = (index: number, run: () => void, ms: number) => {
    const id = window.setTimeout(run, ms);
    timers.current.set(index, [...(timers.current.get(index) ?? []), id]);
  };

  /** Runs one row's statement, after `delay`. */
  const run = (index: number, delay = 0) => {
    const element = list.current;
    clear(index);
    const press = stageMs(element, "--dur-press");
    const execute = stageMs(element, "--dur-execute-short");
    later(
      index,
      () => {
        at(setRan, index, true);
        at(setPhases, index, "highlight");
      },
      delay,
    );
    later(index, () => at(setPhases, index, "executing"), delay + press);
    later(
      index,
      () => {
        setRunIds((all) => all.map((id, i) => (i === index ? id + 1 : id)));
        at(setPhases, index, "answered");
      },
      delay + press + execute,
    );
  };

  // Run each row the first time most of it is on screen. Rows that arrive in the same
  // moment (a fast scroll, a tall screen) run a stagger apart, top first.
  useEffect(() => {
    const element = list.current;
    if (!element || reduced) return;
    const pending = new Set(REFUSALS.map((_, i) => i));
    const observer = new IntersectionObserver(
      (entries) => {
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.row))
          .filter((index) => pending.has(index))
          .sort((a, b) => a - b);
        const stagger = stageMs(element, "--stagger");
        arrived.forEach((index, k) => {
          pending.delete(index);
          observer.unobserve(element.children[index]);
          run(index, k * stagger);
        });
      },
      { threshold: 0.6 },
    );
    for (const row of element.children) observer.observe(row);
    const all = timers.current;
    return () => {
      observer.disconnect();
      all.forEach((ids) => ids.forEach(clearTimeout));
    };
    // `run` only schedules state updates through stable setters and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const runAgain = (index: number) => {
    const words = `#${f.count(index + 1)}: ${REFUSALS[index].refusal}`;
    setAnnouncement((last) => (last === words ? `${words} ` : words));
    if (reduced) {
      // No drain and no stamp: the answer prints again as a fade.
      setRunIds((all) => all.map((id, i) => (i === index ? id + 1 : id)));
      return;
    }
    run(index);
  };

  const showRest = () => {
    foldFrom.current = list.current?.offsetHeight ?? null;
    setShowAll(true);
    // The button goes away with the fold: carry focus to the first row it opened.
    requestAnimationFrame(() => (list.current?.children[SHOWN_ON_PHONE] as HTMLElement | undefined)?.focus());
  };

  return (
    <>
      <div className="receipt torn mt-8">
        <ol ref={list}>
          {REFUSALS.map(({ attempt, sql, refusal }, index) => {
            // Before the page is live, and with reduced motion, every answer stays printed.
            const live = hydrated && !reduced;
            const phase = live && !ran[index] ? "idle" : phases[index];
            const open = !live || phase === "answered";
            return (
              <li
                key={sql}
                data-row={index}
                tabIndex={index === SHOWN_ON_PHONE ? -1 : undefined}
                className={`grid gap-x-6 gap-y-2 border-b border-hairline px-5 py-4 outline-offset-[-2px] last:border-b-0 sm:px-6 md:grid-cols-[2rem_minmax(0,12rem)_minmax(0,1fr)_minmax(0,18.5rem)] md:items-start ${
                  folded && index >= SHOWN_ON_PHONE ? "max-md:hidden" : ""
                } ${folded && index === SHOWN_ON_PHONE - 1 ? "max-md:border-b-0" : ""}`}
              >
                <span aria-hidden className="font-mono text-xs leading-6 text-ink-3">
                  #{f.count(index + 1)}
                </span>
                <p className="leading-6 font-semibold">{attempt[language]}</p>
                <code
                  lang="en"
                  data-lit={phase === "highlight" || undefined}
                  className="-mx-1.5 self-start rounded-mark px-1.5 py-0.5 font-mono text-xs leading-relaxed break-words text-ink-2 transition-[background-color] duration-(--dur-press) ease-out data-lit:bg-liner"
                >
                  {sql}
                </code>
                <div lang="en" className="min-w-0">
                  <div aria-hidden className="h-0.5 overflow-hidden">
                    <div
                      key={runIds[index]}
                      data-run={phase === "executing" || undefined}
                      className="execute-bar h-full bg-ink opacity-0 data-run:opacity-100"
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)]">
                    <div aria-hidden className="invisible col-start-1 row-start-1 py-1">
                      <p className="refusal-stamp max-w-[calc(100%-0.75rem)] px-2 py-1 font-mono text-xs leading-relaxed font-semibold [overflow-wrap:anywhere]">
                        {refusal}
                      </p>
                    </div>
                    <div
                      className="fault-reveal col-start-1 row-start-1"
                      data-open={open || undefined}
                      data-quiet={(live && !ran[index]) || undefined}
                    >
                      <div className="-mx-3 min-h-0 overflow-hidden px-3">
                        <div className="py-1">
                          <p
                            key={runIds[index]}
                            className={`refusal-stamp max-w-[calc(100%-0.75rem)] px-2 py-1 font-mono text-xs leading-relaxed font-semibold [overflow-wrap:anywhere] ${
                              runIds[index] > 0 ? "stamp-hit" : ""
                            }`}
                          >
                            {refusal}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    lang={language}
                    onClick={() => runAgain(index)}
                    aria-label={t.runAgainLabel(f.count(index + 1))}
                    className="press-quiet -ml-2 flex min-h-11 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-ink-2 hover:bg-liner hover:text-ink md:mt-0.5 md:min-h-8"
                  >
                    <RotateCcw aria-hidden size={13} strokeWidth={2.5} className="run-again-icon" />
                    {t.runAgain}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {folded ? (
          <button
            type="button"
            onClick={showRest}
            className="press-quiet flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-ink text-sm font-semibold hover:bg-liner md:hidden"
          >
            {t.showRest(f.count(REFUSALS.length - SHOWN_ON_PHONE))}
            <ChevronDown aria-hidden size={16} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
      <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-ink-2">
        <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink" />
        <span>{t.breakItNote}</span>
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
