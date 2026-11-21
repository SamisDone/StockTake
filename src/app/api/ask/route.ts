import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ChatCompletion, RunModel } from "@/assistant/ask";
import { askRequest } from "@/assistant/protocol";
import { getDb } from "@/db/client";
import { answerStream } from "@/server/ask";
import { getSessionUser } from "@/server/dal";

/**
 * POST a question, get the answer as newline-delimited JSON events (see
 * src/assistant/protocol.ts). The session is checked here, next to the data, like every
 * Server Action: proxy.ts only redirects requests that carry no cookie at all.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to ask a question." }, { status: 401 });

  const parsed = askRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { env } = await getCloudflareContext({ async: true });
  // The binding's types list models by name; the model ID lives in src/assistant/config.ts.
  const run: RunModel = (model, input) =>
    env.AI.run(model as Parameters<typeof env.AI.run>[0], input as never) as Promise<ChatCompletion>;

  const stream = answerStream({ db: await getDb(), user, input: parsed.data, run, now: new Date() });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
