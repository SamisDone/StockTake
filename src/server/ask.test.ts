import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatCompletion } from "@/assistant/ask";
import { LIMITS } from "@/assistant/config";
import type { AskEvent } from "@/assistant/protocol";
import { claimQuestion } from "@/assistant/usage";
import type { Database } from "@/db/database";
import type { SessionUser } from "@/domain/auth";
import { createTestDb, scalar } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { answerStream } from "./ask";

const now = new Date(Date.UTC(2026, 10, 21, 9));
const sam: SessionUser = { id: 2, email: "sam@example.com", name: "Sam Okafor", role: "staff" };
let db: Database;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await seedBasics(db);
});

async function events(run: (model: string) => Promise<ChatCompletion>) {
  const stream = answerStream({ db, user: sam, input: { question: "What's out?", history: [] }, run, now });
  const text = await new Response(stream).text();
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as AskEvent);
}

const questionsUsed = () => scalar(client, "SELECT coalesce(sum(questions), 0) FROM assistant_usage WHERE user_id = 2");

describe("answerStream", () => {
  it("streams each tool step, then the answer, and counts the question with its cost", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [{ id: "c1", type: "function", function: { name: "search_products", arguments: "{}" } }],
            },
          },
        ],
        usage: { neurons: 4 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Widget and Gadget are out." } }],
        usage: { neurons: 3 },
      });

    const [step, answer, ...rest] = await events(run);
    expect(rest).toEqual([]);
    expect(step).toEqual({
      type: "step",
      step: { tool: "search_products", summary: "Searched products: 2 matches", ok: true },
    });
    expect(answer).toMatchObject({
      type: "answer",
      answer: { text: "Widget and Gadget are out.", proposal: null },
      allowance: {
        questionsLeft: LIMITS.questionsPerDay - 1,
        allowanceLeft: true,
        resetsAt: "2026-11-22T00:00:00.000Z",
      },
    });
    expect(answer).not.toHaveProperty("answer.neurons");
    expect(await questionsUsed()).toBe(1);
    expect(await scalar(client, "SELECT neurons FROM assistant_usage WHERE user_id = 2")).toBe(7);
  });

  it("gives the question back when the model fails", async () => {
    const run = vi.fn().mockRejectedValue(new Error("upstream down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await events(run)).toEqual([
      expect.objectContaining({
        type: "refused",
        reason: "failed",
        allowance: expect.objectContaining({ questionsLeft: 20 }),
      }),
    ]);
    expect(await questionsUsed()).toBe(0);
  });

  it("refuses without calling the model once the person's questions are used", async () => {
    for (let i = 0; i < LIMITS.questionsPerDay; i++) await claimQuestion(db, 2, now);
    const run = vi.fn();
    expect(await events(run)).toEqual([
      expect.objectContaining({
        type: "refused",
        reason: "questions",
        allowance: expect.objectContaining({ questionsLeft: 0 }),
      }),
    ]);
    expect(run).not.toHaveBeenCalled();
  });
});
