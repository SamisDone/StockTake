import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { createTestDb } from "@/test/db";
import { products, suppliers } from "@/db/schema";
import { seedBasics } from "@/test/fixtures";
import { type ChatCompletion, type ChatInput, AssistantError, ask, mentionedRefs, readCompletion } from "./ask";
import { ASSISTANT_MODEL, FALLBACK_MODEL, MAX_MODEL_CALLS } from "./config";

const now = new Date(Date.UTC(2026, 10, 21, 9));
let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

const reply = (content: string, neurons = 2): ChatCompletion => ({
  choices: [{ message: { content, tool_calls: [] } }],
  usage: { neurons },
});
const callTool = (name: string, args: unknown, id = `call-${name}`): ChatCompletion => ({
  choices: [
    {
      message: {
        content: "",
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
    },
  ],
  usage: { prompt_tokens: 1000, completion_tokens: 20 },
});

/** A model that answers from a script, recording what it was sent. */
function scripted(...responses: (ChatCompletion | Error)[]) {
  const calls: { model: string; input: ChatInput }[] = [];
  const run = async (model: string, input: ChatInput) => {
    calls.push({ model, input: structuredClone(input) });
    const next = responses.shift();
    if (!next) throw new Error("script ran out");
    if (next instanceof Error) throw next;
    return next;
  };
  return { run, calls };
}

describe("ask", () => {
  it("runs the tools the model calls and answers with the records it names", async () => {
    const { run, calls } = scripted(
      callTool("search_products", { status: "out" }),
      reply("Both are out: **Widget** and Gadget (GAD-002). Order from Northwind Supply.", 3),
    );
    const steps: string[] = [];
    const answer = await ask({ run, db, now, question: "What's out?", onStep: (s) => steps.push(s.summary) });

    expect(answer.text).toMatch(/^Both are out/);
    expect(answer.steps).toEqual([
      { tool: "search_products", summary: "Searched products for out of stock: 2 matches", ok: true },
    ]);
    expect(steps).toEqual(["Searched products for out of stock: 2 matches"]);
    expect(answer.refs.map((r) => r.label).sort()).toEqual(["Gadget", "Widget"]);
    expect(answer.neurons).toBeCloseTo(1000 * 0.0055 + 20 * 0.0364 + 3);
    expect(answer.model).toBe(ASSISTANT_MODEL);

    // The second call carries the tool's result, tied to the call by its ID.
    const sent = calls[1].input.messages;
    expect(sent.at(-2)).toMatchObject({ role: "assistant", tool_calls: [{ id: "call-search_products" }] });
    expect(sent.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-search_products" });
    expect(JSON.parse((sent.at(-1) as { content: string }).content)).toMatchObject({ matched: 2 });
    expect(calls[0].input.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("hands invalid arguments back to the model as an error it can correct", async () => {
    const { run, calls } = scripted(
      callTool("get_product", { productId: "widget" }),
      callTool("get_product", { productId: 1 }),
      reply("Widget has none on hand."),
    );
    const answer = await ask({ run, db, now, question: "Widget?" });

    expect(answer.steps.map((s) => s.ok)).toEqual([false, true]);
    expect(answer.steps[0].summary).toMatch(/^Invalid arguments: productId/);
    expect(JSON.parse((calls[1].input.messages.at(-1) as { content: string }).content)).toHaveProperty("error");
  });

  it("makes the last call answer without tools", async () => {
    const loops = Array.from({ length: MAX_MODEL_CALLS - 1 }, () => callTool("list_suppliers", {}));
    const { run, calls } = scripted(...loops, reply("Northwind Supply is your only supplier."));
    await ask({ run, db, now, question: "Suppliers?" });

    expect(calls).toHaveLength(MAX_MODEL_CALLS);
    expect(calls.map((c) => c.input.tool_choice)).toEqual([...loops.map(() => "auto"), "none"]);
  });

  it("returns a draft proposal without writing anything", async () => {
    const { run } = scripted(
      callTool("draft_purchase_order", { supplierId: 1 }),
      reply("Here's an order to Northwind Supply for both products."),
    );
    const answer = await ask({ run, db, now, question: "Order what's out" });
    expect(answer.proposals).toHaveLength(1);
    expect(answer.proposals[0]).toMatchObject({ supplierId: 1, totalCents: 50 * 250 + 20 * 400 });
    expect(answer.refs.map((r) => r.label)).toEqual(["Northwind Supply"]);
  });

  it("keeps a proposal for each supplier, the latest one when a supplier comes up twice", async () => {
    await db.insert(suppliers).values({ id: 2, name: "Harbor Packaging", leadTimeDays: 3 });
    await db.insert(products).values({
      id: 3,
      sku: "BOX-003",
      name: "Box",
      supplierId: 2,
      unitCostCents: 100,
      unitPriceCents: 300,
      reorderPoint: 10,
      reorderQuantity: 40,
    });
    const { run } = scripted(
      callTool("draft_purchase_order", { supplierId: 1, lines: [{ productId: 1, quantity: 10 }] }, "a"),
      callTool("draft_purchase_order", { supplierId: 2 }, "b"),
      callTool("draft_purchase_order", { supplierId: 1, lines: [{ productId: 2, quantity: 5 }] }, "c"),
      reply("I've proposed orders to Northwind Supply and Harbor Packaging."),
    );
    const answer = await ask({ run, db, now, question: "What should I order?" });
    expect(answer.proposals.map((p) => [p.supplierId, p.lines.map((l) => [l.productId, l.quantity])])).toEqual([
      [1, [[2, 5]]],
      [2, [[3, 40]]],
    ]);
  });

  it("sends earlier turns with the records they named", async () => {
    const { run, calls } = scripted(reply("It has none."));
    await ask({
      run,
      db,
      now,
      question: "And how many does it have?",
      history: [
        {
          question: "What's out?",
          answer: "Widget.",
          refs: [{ kind: "product", id: 1, label: "Widget", code: "WID-001" }],
        },
      ],
    });
    expect(calls[0].input.messages.slice(1)).toEqual([
      { role: "user", content: "What's out?" },
      { role: "assistant", content: "Widget.\n\n[Records in this answer: product 1 Widget (WID-001)]" },
      { role: "user", content: "And how many does it have?" },
    ]);
  });

  it("tries the fallback model once when the main one fails", async () => {
    const { run, calls } = scripted(new Error("InferenceUpstreamError: 5xx"), reply("Fine."));
    const answer = await ask({ run, db, now, question: "Hi" });
    expect(calls.map((c) => c.model)).toEqual([ASSISTANT_MODEL, FALLBACK_MODEL]);
    expect(answer.model).toBe(FALLBACK_MODEL);
  });

  it("says plainly when the free allocation is used up or the model fails", async () => {
    const allowance = scripted(new Error("4006: you have used up your daily free allocation of 10,000 neurons"));
    await expect(ask({ run: allowance.run, db, now, question: "Hi" })).rejects.toMatchObject({
      reason: "allowance",
    });
    expect(allowance.calls).toHaveLength(1);

    const broken = scripted(new Error("boom"), new Error("boom again"));
    await expect(ask({ run: broken.run, db, now, question: "Hi" })).rejects.toBeInstanceOf(AssistantError);

    const empty = scripted(reply("  "));
    await expect(ask({ run: empty.run, db, now, question: "Hi" })).rejects.toMatchObject({ reason: "failed" });
  });
});

/** Server-sent events, split at awkward places the way a network splits them. */
function sse(...chunks: unknown[]) {
  const text = chunks
    .map(
      (c) => `data: ${typeof c === "string" ? c : JSON.stringify(c)}

`,
    )
    .join("");
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let at = 0; at < bytes.length; at += 7) controller.enqueue(bytes.slice(at, at + 7));
      controller.close();
    },
  });
}

describe("readCompletion", () => {
  it("puts streamed text and pieced-together tool calls back into one completion", async () => {
    const pieces: string[] = [];
    const completion = await readCompletion(
      sse(
        { choices: [{ delta: { content: "Let me " } }] },
        { choices: [{ delta: { content: "check." } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "search_products" } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"status":' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"out"}' } }] } }] },
        { usage: { neurons: 4 } },
        "[DONE]",
      ),
      (delta) => pieces.push(delta),
    );
    expect(pieces).toEqual(["Let me ", "check."]);
    expect(completion.choices[0].message.content).toBe("Let me check.");
    expect(completion.choices[0].message.tool_calls).toEqual([
      { id: "c1", type: "function", function: { name: "search_products", arguments: '{"status":"out"}' } },
    ]);
    expect(completion.usage).toEqual({ neurons: 4 });
  });

  it("reads Workers AI's own shape too", async () => {
    const completion = await readCompletion(
      sse({ response: "Two " }, { response: "are out." }, { tool_calls: [{ name: "list_orders", arguments: {} }] }),
      () => {},
    );
    expect(completion.choices[0].message.content).toBe("Two are out.");
    expect(completion.choices[0].message.tool_calls?.[0].function).toEqual({ name: "list_orders", arguments: "{}" });
  });
});

describe("ask, streamed", () => {
  it("announces each lookup, takes back a preamble, and streams the answer", async () => {
    const streams = [
      sse(
        { choices: [{ delta: { content: "Checking." } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "c1", function: { name: "search_products", arguments: '{"status":"out"}' } },
                ],
              },
            },
          ],
        },
      ),
      sse({ choices: [{ delta: { content: "Widget " } }] }, { choices: [{ delta: { content: "is out." } }] }),
    ];
    const events: string[] = [];
    const answer = await ask({
      run: async () => {
        throw new Error("not used");
      },
      stream: async () => streams.shift()!,
      db,
      now,
      question: "What's out?",
      onLookup: (tool) => events.push(`lookup ${tool}`),
      onStep: (step) => events.push(`step ${step.tool}`),
      onText: (delta) => events.push(`text ${delta}`),
      onReset: () => events.push("reset"),
    });
    expect(events).toEqual([
      "text Checking.",
      "reset",
      "lookup search_products",
      "step search_products",
      "text Widget ",
      "text is out.",
    ]);
    expect(answer.text).toBe("Widget is out.");
  });

  it("falls back to a plain call when the stream breaks", async () => {
    const { run } = scripted(reply("Nothing is out."));
    const answer = await ask({
      run,
      stream: async () => {
        throw new Error("stream refused");
      },
      db,
      now,
      question: "What's out?",
    });
    expect(answer.text).toBe("Nothing is out.");
  });
});

describe("mentionedRefs", () => {
  it("keeps the records named in the text, once each, by name or code", () => {
    const refs = [
      { kind: "product" as const, id: 1, label: "Widget", code: "WID-001" },
      { kind: "product" as const, id: 2, label: "Gadget", code: "GAD-002" },
      { kind: "product" as const, id: 1, label: "Widget", code: "WID-001" },
      { kind: "order" as const, id: 7, label: "PO-0007", code: "PO-0007" },
    ];
    expect(mentionedRefs("widget is low; PO-0007 brings more.", refs).map((r) => r.id)).toEqual([1, 7]);
    expect(mentionedRefs("GAD-002 is fine", refs).map((r) => r.id)).toEqual([2]);
  });
});
