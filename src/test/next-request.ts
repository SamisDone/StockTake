import { vi } from "vitest";

/**
 * Stand-ins for the request-time Next.js APIs the data-access layer uses, so Server
 * Actions can be tested against the in-memory database. Wire them up with vi.mock:
 *
 *   vi.mock("next/headers", () => ({ cookies: async () => request.cookies }));
 *   vi.mock("next/navigation", () => ({ redirect: request.redirect }));
 */
export function fakeRequest() {
  const jar = new Map<string, { name: string; value: string; [option: string]: unknown }>();

  const cookies = {
    get: (name: string) => jar.get(name),
    set: (cookie: { name: string; value: string }) => void jar.set(cookie.name, cookie),
    delete: (name: string) => void jar.delete(name),
  };

  /** Throws like the real redirect(), so code after it never runs. */
  const redirect = vi.fn((url: string): never => {
    throw new RedirectSignal(url);
  });

  return { jar, cookies, redirect };
}

export class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

/** Runs a Server Action and returns where it redirected to, failing if it didn't. */
export async function redirectOf(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Expected a redirect");
}
