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
import type { MoneyPrefs } from "@/lib/money";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { ASK_COPY, type AskCopy } from "./copy";
import { FaultText } from "@/components/fault";

/**
 * The Ask page: a conversation held in the browser. Each question is POSTed with the
 * recent turns; the answer streams back as events, a step per lookup as it runs and then
 * the answer, which prints in. The page stays alive in the background while the person
 * follows a link, so the conversation is still there when they come back.
 */

type Answered = { text: string; refs: Ref[]; proposals: Proposal[]; steps: Step[] };
type Written = { id: number; number: string };
type Problem = Refusal | "signed-out" | "network";

type Turn = {
  id: number;
  question: string;
  steps: Step[];
  /** The lookup running now, by its tool's name. */
  running: string | null;
  /** The answer as it's being written, before it arrives whole with its links. */
  draft: string;
  answer: Answered | null;
  problem: Problem | null;
  /** Prints in once, when it first appears; never again when the page is shown again. */
  fresh: boolean;
  /** The drafts its proposals became, by supplier, so coming back can't write one twice. */
  written: Record<number, Written>;
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

export function Conversation({
  initialAllowance,
  money,
  language,
}: {
  initialAllowance: WireAllowance;
  money: MoneyPrefs;
  language: Language;
}) {
  const t = ASK_COPY[language];
  const f = formats(language);
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
    const turn: Turn = {
      id,
      question: text,
      steps: [],
      running: null,
      draft: "",
      answer: null,
      problem: null,
      fresh: true,
      written: {},
    };
    setTurns((all) => [...all.filter((t) => t.id !== replacing), turn]);
    setDraft("");
    setBusy(true);
    // The question counts from the moment it's sent (the server claims it before asking
    // the model), so the count drops now; the answer brings the server's own figures,
    // and a request that never got an answer gives the question back.
    const before = allowance;
    setAllowance((a) => ({ ...a, questionsLeft: Math.max(a.questionsLeft - 1, 0) }));
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
        setAllowance(before);
        update(id, () => ({ problem: "signed-out" }));
        return;
      }
      if (!response.ok || !events) {
        setAllowance(before);
        update(id, () => ({ problem: "failed" }));
        return;
      }
      let finished = false;
      for await (const event of readEvents(response)) {
        if (event.type === "lookup") {
          update(id, () => ({ running: event.tool }));
        } else if (event.type === "step") {
          update(id, (t) => ({ steps: [...t.steps, event.step], running: null }));
        } else if (event.type === "text") {
          update(id, (t) => ({ draft: t.draft + event.delta }));
        } else if (event.type === "reset") {
          update(id, () => ({ draft: "" }));
        } else {
          finished = true;
          setAllowance(event.allowance);
          // An answer already printed as it was written doesn't print in again.
          update(id, (t) =>
            event.type === "answer"
              ? { answer: event.answer, fresh: !t.draft, running: null }
              : { problem: event.reason, fresh: true, running: null },
          );
        }
      }
      if (!finished) {
        setAllowance(before);
        update(id, () => ({ problem: "network" }));
      }
    } catch {
      setAllowance(before);
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
        <Intro onPick={(q) => void send(q)} disabled={busy || limit !== null} t={t} />
      ) : (
        <ol aria-label={t.conversation}>
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
                money={money}
                language={language}
                onPrinted={() => update(turn.id, () => ({ fresh: false }))}
                onRetry={() => void send(turn.question, turn.id)}
                onWritten={(supplierId, written) =>
                  update(turn.id, (current) => ({ written: { ...current.written, [supplierId]: written } }))
                }
                canRetry={!busy && limit === null}
              />
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={submit}
        aria-label={t.askQuestion}
        className="sticky bottom-0 z-10 border-t-2 border-ink bg-label"
      >
        {limit ? (
          <p role="status" className="bg-stock px-5 py-3 text-sm sm:px-8">
            {limit === "questions"
              ? t.limit.questions(f.count(allowance.questionsPerDay))
              : t.limit.allowance(f.time(new Date(allowance.allowanceResetsAt)))}
          </p>
        ) : null}
        <div className="flex">
          <div className="min-w-0 flex-1 px-5 pt-2.5 pb-1.5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)] sm:px-8">
            <label htmlFor="question" className="field-name block">
              {t.question}
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
              placeholder={turns.length === 0 ? t.placeholder : t.followUp}
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
              {t.ask}
            </span>
          </button>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 border-t border-hairline px-5 text-xs text-ink-3 sm:px-8">
          <p id="question-hint">
            {left <= 100 ? t.charactersLeft(f.count(left)) : null}
            {allowance.questionsLeft === 0
              ? t.noneLeft
              : t.left(f.count(allowance.questionsLeft), f.count(allowance.questionsPerDay))}
            <span className="max-sm:hidden">{t.more}</span>
          </p>
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={() => setTurns([])}
              disabled={busy}
              className="press-quiet -mr-2 min-h-11 shrink-0 rounded-control px-2 text-sm font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink disabled:text-ink-3"
            >
              {t.startOver}
            </button>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {busy ? t.lookingUp : last?.answer ? t.answered : ""}
        </p>
      </form>
    </>
  );
}

function Intro({ onPick, disabled, t }: { onPick: (question: string) => void; disabled: boolean; t: AskCopy }) {
  return (
    <div className="pt-6 pb-8">
      <div className="max-w-prose space-y-3 px-5 sm:px-8">
        <p className="text-lg leading-relaxed">{t.intro}</p>
        <p className="text-sm text-ink-2">{t.introNote}</p>
      </div>
      <h2 className="field-name mt-8 px-5 sm:px-8">{t.tryOne}</h2>
      <ul className="mt-1.5 border-t border-ink">
        {t.starters.map((question) => (
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
  money,
  language,
  onPrinted,
  onRetry,
  onWritten,
  canRetry,
}: {
  turn: Turn;
  money: MoneyPrefs;
  language: Language;
  onPrinted: () => void;
  onRetry: () => void;
  onWritten: (supplierId: number, written: Written) => void;
  canRetry: boolean;
}) {
  const t = ASK_COPY[language];
  const settled = turn.answer !== null || turn.problem !== null;
  // Only what has just arrived prints; the class is dropped once it has.
  const print = turn.fresh ? "print-in" : "";

  return (
    <>
      <div className={settled ? "" : print}>
        <p className="field-name">{t.question}</p>
        <p className="text-lg font-bold text-pretty">{turn.question}</p>
      </div>

      {!settled ? (
        <div className="mt-3">
          {turn.draft ? (
            // The answer as it's written: plain until it arrives whole, with its links.
            <div aria-busy>
              <AnswerText text={turn.draft} refs={[]} language={language} />
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-2">{t.lookingUp}</p>
              <StepList steps={turn.steps} running={turn.running} t={t} live />
            </>
          )}
        </div>
      ) : turn.answer ? (
        <div className={`mt-3 ${print}`} onAnimationEnd={onPrinted}>
          <AnswerText text={turn.answer.text} refs={turn.answer.refs} language={language} />
          {turn.answer.proposals.map((proposal) => (
            <ProposalSlip
              key={proposal.supplierId}
              proposal={proposal}
              money={money}
              language={language}
              written={turn.written[proposal.supplierId] ?? null}
              onWritten={(written) => onWritten(proposal.supplierId, written)}
            />
          ))}
          <Working steps={turn.answer.steps} t={t} count={formats(language).count} />
        </div>
      ) : (
        <div className={`mt-3 ${print}`} onAnimationEnd={onPrinted}>
          <ProblemNote problem={turn.problem!} onRetry={onRetry} canRetry={canRetry} t={t} />
        </div>
      )}
    </>
  );
}

function ProblemNote({
  problem,
  onRetry,
  canRetry,
  t,
}: {
  problem: Problem;
  onRetry: () => void;
  canRetry: boolean;
  t: AskCopy;
}) {
  if (problem === "signed-out") {
    return (
      <p className="bg-stock px-3 py-2 text-sm">
        {t.sessionEnded[0]}
        <Link href="/login?next=/ask" className="font-semibold underline underline-offset-4">
          {t.sessionEnded[1]}
        </Link>
        {t.sessionEnded[2]}
      </p>
    );
  }
  if (problem === "questions" || problem === "allowance") {
    return <p className="text-sm text-ink-2">{t.notAnswered(problem === "questions")}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FaultText>{t.problem[problem]}</FaultText>
      <button
        type="button"
        onClick={onRetry}
        disabled={!canRetry}
        className="press-quiet -ml-2 min-h-11 rounded-control px-2 text-sm font-semibold underline decoration-ink-3 underline-offset-4 enabled:hover:decoration-ink disabled:text-ink-3"
      >
        {t.askAgain}
      </button>
    </div>
  );
}

/** What the answer was worked out from: one line per lookup, the tool named as the machine names it. */
function Working({ steps, t, count }: { steps: Step[]; t: AskCopy; count: (n: number) => string }) {
  if (steps.length === 0) {
    return <p className="mt-4 text-sm text-ink-3">{t.noLookups}</p>;
  }
  return (
    <details className="group mt-4">
      <summary className="press-quiet -ml-3 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink [&::-webkit-details-marker]:hidden">
        {t.howAnswered(steps.length, count(steps.length))}
        <ChevronDown
          aria-hidden
          size={18}
          strokeWidth={2.25}
          className="transition-transform duration-150 ease-out group-open:rotate-180"
        />
      </summary>
      <StepList steps={steps} t={t} />
    </details>
  );
}

function StepList({
  steps,
  running = null,
  t,
  live = false,
}: {
  steps: Step[];
  /** A lookup still running: its line prints now and fills in when it's done. */
  running?: string | null;
  t: AskCopy;
  live?: boolean;
}) {
  if (steps.length === 0 && !running) return null;
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
          <span className={step.ok ? "" : "text-ink-2"}>{step.ok ? step.summary : t.notRun(step.summary)}</span>
        </li>
      ))}
      {running ? (
        <li className="grid gap-x-4 border-b border-hairline py-2 text-sm print-in sm:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-0.5 font-mono text-xs text-ink-3">{running}</span>
          <span className="text-ink-2">{t.running}</span>
        </li>
      ) : null}
    </ol>
  );
}
