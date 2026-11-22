import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { type Role, roles, sessions, users } from "@/db/schema";
import { DEMO_USERS } from "@/seed/accounts";
import { type Actor, requireAdmin } from "./actor";
import { logActivity } from "./activity";
import { createUser, hashPassword, verifyPassword } from "./auth";
import { said } from "./error-copy";
import { DomainError, parseInput } from "./errors";

/**
 * The team: who can sign in, and as what. There's no email service (everything here is
 * free), so a new person or a reset gets a temporary password that the admin hands over
 * in person, shown once. The two public demo accounts are kept exactly as they are, so a
 * visitor can't lock the next one out of the demo.
 */

const DEMO_EMAILS = new Set<string>(DEMO_USERS.map((u) => u.email));

/** Whether this is one of the public demo accounts, which nobody can change. */
export function isDemoAccount(email: string) {
  return DEMO_EMAILS.has(email);
}

/** Letters and digits that can't be misread for each other (no 0/o, 1/l/i). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A temporary password to read out or write down: twelve characters from the clear
 * alphabet in three groups, "k7mx-p2qd-9hrt". About 59 bits, enough for a password the
 * person replaces on first sign-in.
 */
export function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  // 256 isn't a multiple of 31, so the first few letters come up a hair more often;
  // a hair of 59 bits doesn't matter for a password that's replaced right away.
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Everyone on the team, admins first, then by name, with when they were added. */
export async function listTeam(db: Database) {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, addedAt: users.createdAt })
    .from(users)
    .orderBy(sql`${users.role} = 'admin' DESC`, asc(users.name));
  return rows.map((row) => ({ ...row, demo: isDemoAccount(row.email) }));
}

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];

async function loadPerson(db: Database, id: number) {
  const [person] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, id));
  if (!person) throw new DomainError("not_found", said("noPerson"));
  return person;
}

const personId = z.number().int().positive();

export const newPersonInput = z.object({
  email: z.string(),
  name: z.string(),
  role: z.enum(roles),
});

/** Adds a person with a temporary password, returned once for the admin to hand over. */
export async function addPerson(db: Database, actor: Actor, raw: z.input<typeof newPersonInput>, now = new Date()) {
  const input = parseInput(newPersonInput, raw);
  const password = temporaryPassword();
  const person = await createUser(db, actor, { ...input, password }, now);
  return { person, password };
}

/** Makes someone an admin or staff. Not yourself (another admin does that), and not a demo account. */
export async function setRole(db: Database, actor: Actor, id: number, role: Role, now = new Date()) {
  requireAdmin(actor, "managePeople");
  const person = await loadPerson(db, parseInput(personId, id));
  const next = parseInput(z.enum(roles), role);
  if (person.id === actor.id) throw new DomainError("forbidden", said("notYourOwnRole"));
  if (isDemoAccount(person.email)) throw new DomainError("forbidden", said("demoAccountKept"));
  if (person.role === next) return { name: person.name, role: next };

  await db.batch([
    db.update(users).set({ role: next }).where(eq(users.id, person.id)),
    logActivity(
      db,
      actor,
      {
        action: "user.role_changed",
        entityType: "user",
        entityId: person.id,
        facts: { name: person.name, role: next },
      },
      now,
    ),
  ]);
  return { name: person.name, role: next };
}

/**
 * Gives someone a new temporary password and signs them out everywhere, so whoever had
 * the old one is out at once. Returned once, for the admin to hand over.
 */
export async function resetPassword(db: Database, actor: Actor, id: number, now = new Date()) {
  requireAdmin(actor, "managePeople");
  const person = await loadPerson(db, parseInput(personId, id));
  if (person.id === actor.id) throw new DomainError("forbidden", said("resetYourOwn"));
  if (isDemoAccount(person.email)) throw new DomainError("forbidden", said("demoAccountKept"));

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await db.batch([
    db.update(users).set({ passwordHash }).where(eq(users.id, person.id)),
    db.delete(sessions).where(eq(sessions.userId, person.id)),
    logActivity(
      db,
      actor,
      { action: "user.password_reset", entityType: "user", entityId: person.id, facts: { name: person.name } },
      now,
    ),
  ]);
  return { name: person.name, password };
}

export const passwordChangeInput = z.object({
  current: z.string().min(1, "enterPassword"),
  next: z.string().min(12, "passwordLength").max(200),
});

/**
 * Changes your own password, given the current one. Your other sessions end (a phone
 * left signed in elsewhere); this one stays. The demo accounts keep the public password.
 */
export async function changeOwnPassword(
  db: Database,
  actor: Actor,
  raw: z.input<typeof passwordChangeInput>,
  currentSessionId: string,
  now = new Date(),
) {
  const input = parseInput(passwordChangeInput, raw);
  const person = await loadPerson(db, actor.id);
  if (isDemoAccount(person.email)) throw new DomainError("forbidden", said("demoAccountKept"));
  if (!(await verifyPassword(input.current, person.passwordHash))) {
    throw new DomainError("invalid_input", said("wrongCurrentPassword"), "current");
  }

  const passwordHash = await hashPassword(input.next);
  await db.batch([
    db.update(users).set({ passwordHash }).where(eq(users.id, person.id)),
    db.delete(sessions).where(and(eq(sessions.userId, person.id), ne(sessions.id, currentSessionId))),
    logActivity(
      db,
      actor,
      { action: "user.password_changed", entityType: "user", entityId: person.id, facts: { name: person.name } },
      now,
    ),
  ]);
}
