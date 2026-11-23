import "server-only";
import type { z } from "zod";
import type { Database } from "@/db/database";
import type { SessionUser } from "@/domain/auth";
import { AssistantError, type RunModel, type StreamModel, ask } from "@/assistant/ask";
import { type AskEvent, type askRequest, toWire } from "@/assistant/protocol";
import { claimQuestion, getAllowance, recordNeurons, releaseQuestion } from "@/assistant/usage";
import type { Language } from "@/lib/i18n";
import type { MoneyFormat } from "@/lib/money";

/**
 * Answers a signed-in person's question as a stream of events. The question is counted
 * against the day's allowance before the model is called, and given back if no answer
 * comes, so a model failure never costs the person one.
 */
export function answerStream({
  db,
  user,
  input,
  run,
  stream,
  now,
  money,
  language,
}: {
  db: Database;
  user: SessionUser;
  input: z.output<typeof askRequest>;
  run: RunModel;
  stream?: StreamModel;
  now: Date;
  /** How the person reads money. Dollars when left out. */
  money?: MoneyFormat;
  /** The person's language. English when left out. */
  language?: Language;
}) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const allowance = async () => toWire(await getAllowance(db, user.id, now));

      const claim = await claimQuestion(db, user.id, now);
      if (!claim.ok) {
        send({ type: "refused", reason: claim.reason, allowance: await allowance() });
        controller.close();
        return;
      }

      try {
        const { text, refs, proposal, steps, neurons } = await ask({
          run,
          db,
          now,
          question: input.question,
          history: input.history,
          money,
          language,
          stream,
          onStep: (step) => send({ type: "step", step }),
          onLookup: (tool) => send({ type: "lookup", tool }),
          onText: (delta) => send({ type: "text", delta }),
          onReset: () => send({ type: "reset" }),
        });
        await recordNeurons(db, user.id, claim, neurons);
        send({ type: "answer", answer: { text, refs, proposal, steps }, allowance: await allowance() });
      } catch (error) {
        await releaseQuestion(db, user.id, claim.day);
        if (!(error instanceof AssistantError)) console.error("The assistant failed", error);
        const reason = error instanceof AssistantError ? error.reason : "failed";
        send({ type: "refused", reason, allowance: await allowance() });
      }
      controller.close();
    },
  });
}
