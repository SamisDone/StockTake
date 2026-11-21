"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { authenticate, createSession, findUserByEmail, invalidateSession } from "@/domain/auth";
import { DEMO_USERS } from "@/seed/accounts";
import { type FormState, field } from "./form-state";
import { LOGIN_PATH, SESSION_COOKIE, looksLikeSessionToken, safeNextPath, sessionCookie } from "./session-cookie";
import { ACTION_COPY } from "./action-copy";
import { getLanguage } from "./preferences";

const credentials = z.object({
  email: z.string().trim().min(1, "enterEmail").max(320),
  password: z.string().min(1, "enterPassword").max(200),
});

/**
 * The login form's action. On success it sets the session cookie and redirects.
 *
 * A `demo` field of "admin" or "staff" opens that public demo account directly. Its
 * password is published, so checking it would prove nothing and cost a 100,000-iteration
 * PBKDF2 hash, most of the free plan's CPU budget for the request.
 */
export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = ACTION_COPY[await getLanguage()];
  const demo = DEMO_USERS.find((user) => user.role === field(formData, "demo"));
  if (demo) {
    const user = await findUserByEmail(await getDb(), demo.email);
    if (!user) {
      return {
        error: { message: t.noDemo },
        values: { email: "" },
      };
    }
    return startSession(user.id, formData);
  }

  const email = field(formData, "email");
  const values = { email };
  const parsed = credentials.safeParse({ email, password: field(formData, "password") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue.message === "enterPassword" ? t.enterPassword : t.enterEmail;
    return { error: { message, field: String(issue.path[0]) }, values };
  }

  const user = await authenticate(await getDb(), parsed.data.email, parsed.data.password);
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (!user) {
    return {
      error: { message: t.wrongPassword },
      values,
    };
  }
  return startSession(user.id, formData);
}

async function startSession(userId: number, formData: FormData): Promise<never> {
  const { token } = await createSession(await getDb(), userId);
  (await cookies()).set(sessionCookie(token));
  redirect(safeNextPath(field(formData, "next")));
}

/** Ends the session in the database as well as in the browser. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (looksLikeSessionToken(token)) await invalidateSession(await getDb(), token);
  jar.delete(SESSION_COOKIE);
  redirect(LOGIN_PATH);
}
