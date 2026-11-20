"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { authenticate, createSession, invalidateSession } from "@/domain/auth";
import { type FormState, field } from "./form-state";
import { LOGIN_PATH, SESSION_COOKIE, looksLikeSessionToken, safeNextPath, sessionCookie } from "./session-cookie";

const credentials = z.object({
  email: z.string().trim().min(1, "Enter your email address.").max(320),
  password: z.string().min(1, "Enter your password.").max(200),
});

/** The login form's action. On success it sets the session cookie and redirects. */
export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const values = { email };

  const parsed = credentials.safeParse({ email, password: field(formData, "password") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { message: issue.message, field: String(issue.path[0]) }, values };
  }

  const db = await getDb();
  const user = await authenticate(db, parsed.data.email, parsed.data.password);
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (!user) return { error: { message: "That email and password don't match an account." }, values };

  const { token } = await createSession(db, user.id);
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
