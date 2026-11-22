/**
 * The assistant's model and limits, in one place.
 *
 * Workers AI's free allocation is 10,000 neurons a day for the whole account, reset at
 * 00:00 UTC. A question costs about 20 to 80 neurons (a few model calls with the tool
 * definitions in each), so the shared budget stops short of the allocation, leaving room
 * for the questions still running when it's reached.
 */
export const ASSISTANT_MODEL = "@cf/zai-org/glm-4.7-flash";
/** Tried once when a call to the main model fails for a reason other than the allocation. */
export const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export const LIMITS = {
  /** Questions one account can ask per business day (they come back at midnight in Dhaka). */
  questionsPerDay: 20,
  /** Neurons all accounts together can spend per UTC day, Workers AI's day (see `assistant_budget`). */
  neuronsPerDay: 9_000,
};

/** Model calls per question: tool rounds plus the answer. The last one may not call tools. */
export const MAX_MODEL_CALLS = 5;
/** Earlier turns sent with a question, so follow-ups make sense. */
export const MAX_HISTORY_TURNS = 6;
export const MAX_QUESTION_LENGTH = 500;
export const MAX_ANSWER_TOKENS = 700;
