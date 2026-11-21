import { z } from "zod";
import type { Answer, Step } from "./ask";
import { MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH } from "./config";
import type { Allowance } from "./usage";

/**
 * What the Ask page and POST /api/ask say to each other. The browser holds the
 * conversation and sends the recent turns back with each question; the server answers
 * with newline-delimited JSON events: a step per tool call as it runs, then one answer or
 * one refusal.
 */

const ref = z.object({
  kind: z.enum(["product", "supplier", "order"]),
  id: z.number().int().positive(),
  label: z.string().max(200),
  code: z.string().max(60).optional(),
});

export const askRequest = z.object({
  question: z.string().trim().min(1, "Type a question.").max(MAX_QUESTION_LENGTH),
  history: z
    .array(
      z.object({
        question: z.string().max(MAX_QUESTION_LENGTH),
        answer: z.string().max(4000),
        refs: z.array(ref).max(40),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
});
export type AskRequest = z.input<typeof askRequest>;

/** Allowance with its date as text, the way it crosses the wire. */
export type WireAllowance = Omit<Allowance, "resetsAt"> & { resetsAt: string };

export type Refusal = "questions" | "allowance" | "failed";

export type AskEvent =
  | { type: "step"; step: Step }
  | { type: "answer"; answer: Omit<Answer, "neurons" | "model">; allowance: WireAllowance }
  | { type: "refused"; reason: Refusal; allowance: WireAllowance };

export const toWire = (allowance: Allowance): WireAllowance => ({
  ...allowance,
  resetsAt: allowance.resetsAt.toISOString(),
});
