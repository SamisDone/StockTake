import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { roles, sessions, users } from "@/db/schema";
import { type Actor, requireAdmin } from "./actor";
import { logActivity } from "./activity";
import { DomainError, parseInput, violates } from "./errors";

// PBKDF2-SHA256 through WebCrypto. 100,000 iterations is the most Workers allows, and
// native argon2/bcrypt don't run there. The iteration count is stored with each hash,
// so it can change later without invalidating existing passwords.
const ITERATIONS = 100_000;
const MAX_ITERATIONS = 100_000;
const SCHEME = "pbkdf2_sha256";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Compares in time that depends only on the length, not on where the bytes differ. */
function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${SCHEME}$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, rawIterations, salt, hash] = stored.split("$");
  const iterations = Number(rawIterations);
  if (scheme !== SCHEME || !salt || !hash) return false;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false;
  try {
    return equalBytes(await derive(password, fromBase64Url(salt), iterations), fromBase64Url(hash));
  } catch {
    return false;
  }
}

/** Checked against when the email is unknown, so a miss takes as long as a wrong password. */
let dummyHash: Promise<string> | undefined;

export type SessionUser = { id: number; email: string; name: string; role: Actor["role"] };

const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** The user for this email and password, or null. Unknown emails and wrong passwords look the same. */
export async function authenticate(db: Database, email: string, password: string): Promise<SessionUser | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normaliseEmail(email)));

  if (!user) {
    dummyHash ??= hashPassword("timing-equaliser");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export const newUserInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  name: z.string().trim().min(1, "Enter a name.").max(100),
  password: z.string().min(12, "Use at least 12 characters.").max(200),
  role: z.enum(roles),
});
export type NewUserInput = z.input<typeof newUserInput>;

/** Adds a person. Admin-only. */
export async function createUser(db: Database, actor: Actor, raw: NewUserInput, now = new Date()) {
  requireAdmin(actor, "add people");
  const input = parseInput(newUserInput, raw);
  const passwordHash = await hashPassword(input.password);

  try {
    const [[user]] = await db.batch([
      db
        .insert(users)
        .values({ email: input.email, name: input.name, role: input.role, passwordHash, createdAt: now })
        .returning({ id: users.id, email: users.email, name: users.name, role: users.role }),
      logActivity(db, actor, {
        action: "user.created",
        entityType: "user",
        // Same reasoning as createDraft: inside the atomic batch, the new user is max(id).
        entityId: sql<number>`(SELECT max(${users.id}) FROM ${users})`,
        summary: `Added ${input.name} as ${input.role}`,
      }, now),
    ]);
    return user;
  } catch (error) {
    if (violates(error, "UNIQUE constraint failed: users.email")) {
      throw new DomainError("conflict", "Someone already uses that email.", "email");
    }
    throw error;
  }
}

/** SHA-256 hex of a session token: the only form of it the database ever sees. */
export async function hashToken(token: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Starts a session. The returned token goes in the cookie; only its hash is stored. */
export async function createSession(db: Database, userId: number, now = new Date()) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: await hashToken(token), userId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

/**
 * The session's user, or null if the token is unknown or expired. A session past half
 * its lifetime is extended; `renewed` tells the caller to reissue the cookie.
 */
export async function validateSession(db: Database, token: string, now = new Date()) {
  const id = await hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: { id: users.id, email: users.email, name: users.name, role: users.role },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  if (row.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS / 2) {
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    return { user: row.user as SessionUser, expiresAt, renewed: true };
  }
  return { user: row.user as SessionUser, expiresAt: row.expiresAt, renewed: false };
}

export async function invalidateSession(db: Database, token: string) {
  await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
}
