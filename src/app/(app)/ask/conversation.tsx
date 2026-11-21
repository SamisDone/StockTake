"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import type { Step } from "@/assistant/ask";
import { MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH } from "@/assistant/config";
import type { AskEvent, AskRequest, Refusal, WireAllowance } from "@/assistant/protocol";
import type { Proposal, Ref } from "@/assistant/tools";
import { AnswerText } from "./answer";
import { ProposalSlip } from "./proposal";

/**
 * The Ask page: a conversation held in the browser. Each question is POSTed with the
 * recent turns; the answer streams back as events, a step per lookup as it runs and then
 * the answer, which prints in. The page stays alive in the background while the person
 * follows a link, so the conversation is still there when they come back.
 */

const STARTERS = [
  "What's out of stock, and when can we get more?",
  "Which orders are late?",
  "What sold best over the last 28 days?",
  "Draft an order for the supplier with the most products running low.",
];

type Answered = { text: string; refs: Ref[]; proposal: Proposal | null; steps: Step[] };
type Problem = Refusal | "signed-out" | "network";

type Turn = {
  id: number;
  question: string;
  steps: Step[];
  answer: Answered | null;
  problem: Problem | null;
  /** Prints in once, when it first appears; never again when the page is shown again. */
  fresh: boolean;
  written: { id: number; number: string } | null;
};

const LIMIT_COPY: Record<"questions" | "allowance", (cap: number) => string> = {
  questions: (cap) =>
    `You've asked all ${cap} of today's questions on this account. They come back at 00:00 UTC; everything else works as usual.`,
  allowance: () =>
    "Today's free Workers AI allowance has run out. It's shared by everyone using this demo and comes back at 00:00 UTC. Everything else works as usual.",
};

const PROBLEM_COPY: Record<"failed" | "network", string> = {
  failed: "The model didn't answer, so this question wasn't counted.",
  network: "The question didn't reach the server, so it wasn't counted. Check the connection.",
};

async function* readEvents(response: Response) {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (line) yield JSON.parse(line) as AskEvent;
    }
  }
}

export function Conversation({ initialAllowance }: { initialAllowance: WireAllowance }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [allowance, setAllowance] = useState(initialAllowance);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const input = useRef<HTMLTextAreaElement>(null);
  const turnElements = useRef(new Map<number, HTMLLIElement>());

  const limit = !allowance.allowanceLeft ? "allowance" : allowance.questionsLeft === 0 ? "questions" : null;
  const update = (id: number, change: (turn: Turn) => Partial<Turn>) =>
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...change(turn) } : turn)));

  async function send(question: string, replacing?: number) {
    const text = question.trim();
    if (!text || busy || limit) return;

    const history: AskRequest["history"] = turns
      .filter((t) => t.answer && t.id !== replacing)
      .slice(-MAX_HISTORY_TURNS)
      .map((t) => ({ question: t.question, answer: t.answer!.text.slice(0, 4000), refs: t.answer!.refs.slice(0, 40) }));

    const id = nextId.current++;
    const turn: Turn = { id, question: text, steps: [], answer: null, problem: null, fresh: true, written: null };
    setTurns((all) => [...all.filter((t) => t.id !== replacing), turn]);
    setDraft("");
    setBusy(true);
    // The new question moves to the top of the view, so its answer prints below it.
    requestAnimationFrame(() => {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const element = turnElements.current.get(id);
      if (!element) return;
      const from = window.scrollY;
      element.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      // Smooth scrolling from code can be ignored (embedded viewers): jump if it never started.
      if (!reduce) {
        setTimeout(() => {
          if (window.scrollY === from && Math.abs(element.getBoundingClientRect().top - 16) > 2) {
            element.scrollIntoView({ block: "start", behavior: "auto" });
          }
        }, 400);
      }
    });

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, history } satisfies AskRequest),
      });
      // Signed out, the proxy answers with the login page instead of events.
      const events = response.headers.get("content-type")?.includes("application/x-ndjson");
      if (response.status === 401 || (response.ok && !events)) {
        update(id, () => ({ problem: "signed-out" }));
        return;
      }
      if (!response.ok || !events) {
        update(id, () => ({ problem: "failed" }));
        return;
      }
      let finished = false;
      for await (const event of readEvents(response)) {
        if (event.type === "step") {
          update(id, (t) => ({ steps: [...t.steps, event.step] }));
        } else {
          finished = true;
          setAllowance(event.allowance);
          update(id, () =>
            event.type === "answer" ? { answer: event.answer, fresh: true } : { problem: event.reason, fresh: true },
          );
        }
      }
      if (!finished) update(id, () => ({ problem: "network" }));
    } catch {
      update(id, () => ({ problem: "network" }));
    } finally {
      setBusy(false);
      input.current?.focus({ preventScroll: true });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function enterSends(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const left = MAX_QUESTION_LENGTH - draft.length;
  const last = turns.at(-1);

  return (
    <>
      {turns.length === 0 ? (
        <Intro onPick={(q) => void send(q)} disabled={busy || limit !== null} />
      ) : (
        <ol aria-label="Conversation">
          {turns.map((turn) => (
            <li
              key={turn.id}
              ref={(element) => {
                if (element) turnElements.current.set(turn.id, element);
                else turnElements.current.delete(turn.id);
              }}
              className="scroll-mt-4 border-b border-ink px-5 pt-5 pb-6 last:border-b-0 sm:px-8"
            >
              <TurnView
                turn={turn}
                onPrinted={() => update(turn.id, () => ({ fresh: false }))}
                onRetry={() => void send(turn.question, turn.id)}
                onWritten={(written) => update(turn.id, () => ({ written }))}
                canRetry={!busy && limit === null}
              />
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={submit}
        aria-label="Ask a question"
        className="sticky bottom-0 z-10 border-t-2 border-ink bg-label"
      >
        {limit ? (
          <p role="status" className="bg-stock px-5 py-3 text-sm sm:px-8">
            {LIMIT_COPY[limit](allowance.questionsPerDay)}
          </p>
        ) : null}
        <div className="flex">
          <div className="min-w-0 flex-1 px-5 pt-2.5 pb-1.5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] sm:px-8">
            <label htmlFor="question" className="field-name block">
              Question
            </label>
            <textarea
              ref={input}
              id="question"
              name="question"
              rows={1}
              maxLength={MAX_QUESTION_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={enterSends}
              disabled={limit !== null}
              placeholder={turns.length === 0 ? "What's running low at Harbor Packaging Co.?" : "Ask a follow-up"}
              aria-describedby="question-hint"
              className="field-input max-h-40 resize-none overflow-y-auto field-sizing-content placeholder:text-ink-3 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={busy || limit !== null || draft.trim() === ""}
            className="group w-24 shrink-0 bg-ink font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:bg-ink-2 aria-busy:cursor-progress sm:w-28"
            aria-busy={busy}
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              Ask
            </span>
          </button>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 border-t border-hairline px-5 text-xs text-ink-3 sm:px-8">
          <p id="question-hint">
            {left <= 100 ? <>{left} characters left · </> : null}
            {allowance.questionsLeft === 0
              ? "No questions left today"
              : `${allowance.questionsLeft} of ${allowance.questionsPerDay} questions left today`}
            <span className="max-sm:hidden"> · more at 00:00 UTC</span>
          </p>
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={() => setTurns([])}
              disabled={busy}
              className="press-quiet -mr-2 min-h-11 shrink-0 rounded-control px-2 text-sm font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink disabled:text-ink-3"
            >
              Start over
            </button>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {busy ? "Looking it up…" : last?.answer ? "Answered." : ""}
        </p>
      </form>
    </>
  );
}

function Intro({ onPick, disabled }: { onPick: (question: string) => void; disabled: boolean }) {
  return (
    <div className="pt-6 pb-8">
      <div className="max-w-prose space-y-3 px-5 sm:px-8">
        <p className="text-lg leading-relaxed">
          Ask about stock, orders, suppliers and sales in your own words. A language model answers by looking things up
          in the same records every page shows, and it can propose a purchase order for you to check and write.
        </p>
        <p className="text-sm text-ink-2">
          It only reads: it can&apos;t record stock or place orders. Every answer lists what it looked up. The model is
          GLM-4.7 Flash, running on Cloudflare Workers AI.
        </p>
      </div>
      <h2 className="field-name mt-8 px-5 sm:px-8">Try one</h2>
      <ul className="mt-1.5 border-t border-ink">
        {STARTERS.map((question) => (
          <li key={question} className="border-b border-hairline">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(question)}
              className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 text-left font-semibold transition-colors duration-150 enabled:hover:bg-liner/60 disabled:text-ink-3 sm:px-8"
            >
              <span className="origin-left transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {question}
              </span>
              <ArrowRight
                aria-hidden
                size={18}
                strokeWidth={2.25}
                className="shrink-0 text-ink-2 transition-transform duration-150 ease-out group-enabled:group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TurnView({
  turn,
  onPrinted,
  onRetry,
  onWritten,
  canRetry,
}: {
  turn: Turn;
  onPrinted: () => void;
  onRetry: () => void;
  onWritten: (written: { id: number; number: string }) => void;
  canRetry: boolean;
}) {
  const settled = turn.answer !== null || turn.problem !== null;
  // Only what has just arrived prints; the class is dropped once it has.
  const print = turn.fresh ? "print-in" : "";

  return (
    <>
      <div className={settled ? "" : print}>
        <p className="field-name">Question</p>
        <p className="text-lg font-bold text-pretty">{turn.question}</p>
      </div>

      {!settled ? (
        <div className="mt-3">
          <p className="text-sm text-ink-2">Looking it up…</p>
          <StepList steps={turn.steps} live />
        </div>
      ) : turn.answer ? (
        <div className={`mt-3 ${print}`} onAnimationEnd={onPrinted}>
          <AnswerText text={turn.answer.text} refs={turn.answer.refs} />
          {turn.answer.proposal ? (
            <ProposalSlip proposal={turn.answer.proposal} written={turn.written} onWritten={onWritten} />
          ) : null}
          <Working steps={turn.answer.steps} />
        </div>
      ) : (
        <div className={`mt-3 ${print}`} onAnimationEnd={onPrinted}>
          <ProblemNote problem={turn.problem!} onRetry={onRetry} canRetry={canRetry} />
        </div>
      )}
    </>
  );
}

function ProblemNote({ problem, onRetry, canRetry }: { problem: Problem; onRetry: () => void; canRetry: boolean }) {
  if (problem === "signed-out") {
    return (
      <p className="bg-stock px-3 py-2 text-sm">
        Your session has ended.{" "}
        <Link href="/login?next=/ask" className="font-semibold underline underline-offset-4">
          Sign in again
        </Link>{" "}
        to ask.
      </p>
    );
  }
  if (problem === "questions" || problem === "allowance") {
    return (
      <p className="text-sm text-ink-2">
        Not answered: {problem === "questions" ? "no questions left today." : "the day's allowance ran out."}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm">{PROBLEM_COPY[problem]}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={!canRetry}
        className="press-quiet -ml-2 min-h-11 rounded-control px-2 text-sm font-semibold underline decoration-ink-3 underline-offset-4 enabled:hover:decoration-ink disabled:text-ink-3"
      >
        Ask again
      </button>
    </div>
  );
}

/** What the answer was worked out from: one line per lookup, the tool named as the machine names it. */
function Working({ steps }: { steps: Step[] }) {
  if (steps.length === 0) {
    return <p className="mt-4 text-sm text-ink-3">Answered without looking anything up.</p>;
  }
  return (
    <details className="group mt-4">
      <summary className="press-quiet -ml-3 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink [&::-webkit-details-marker]:hidden">
        How this was answered: {steps.length} {steps.length === 1 ? "lookup" : "lookups"}
        <ChevronDown
          aria-hidden
          size={18}
          strokeWidth={2.25}
          className="transition-transform duration-150 ease-out group-open:rotate-180"
        />
      </summary>
      <StepList steps={steps} />
    </details>
  );
}

function StepList({ steps, live = false }: { steps: Step[]; live?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-2 max-w-2xl border-t border-hairline">
      {steps.map((step, i) => (
        <li
          key={i}
          className={`grid gap-x-4 border-b border-hairline py-2 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] ${
            live ? "print-in" : ""
          }`}
        >
          <span className="pt-0.5 font-mono text-xs text-ink-3">{step.tool}</span>
          <span className={step.ok ? "" : "text-ink-2"}>{step.ok ? step.summary : `Not run: ${step.summary}`}</span>
        </li>
      ))}
    </ol>
  );
}
