import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import type { Database } from "@/db/database";
import { type SessionUser, hashToken, validateSession } from "@/domain/auth";
import type { Language } from "@/lib/i18n";
import { getLanguage } from "./preferences";
import { LOGIN_PATH, SESSION_COOKIE, looksLikeSessionToken } from "./session-cookie";

/**
 * The data-access layer: the one place the session is turned into a user. Pages,
 * Server Actions and Route Handlers all go through it, close to the data, so no route
 * relies on proxy.ts for protection.
 */

/** The signed-in person, or null. Read once per request however many components ask. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!looksLikeSessionToken(token)) return null;
  // Validation compares the expiry with the current time. Cookies can be read during a
  // runtime prefetch, the clock can't, so wait for the real request first.
  await connection();
  const session = await validateSession(await getDb(), token);
  return session?.user ?? null;
});

/** The signed-in person. Anyone else is sent to the login page. */
export async function getCurrentUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * For Server Actions and Route Handlers: the database, the verified person to act as,
 * and the language to answer them in. Treat every action as a public endpoint and call
 * this first.
 */
export async function authorize(): Promise<{ db: Database; user: SessionUser; language: Language }> {
  const user = await getCurrentUser();
  return { db: await getDb(), user, language: await getLanguage() };
}

/**
 * The ID of the session this request is signed in with (the SHA-256 of its cookie), for
 * actions that end every session but this one. Call after `authorize()`.
 */
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return hashToken(token);
}
