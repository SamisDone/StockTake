import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, sessions, users } from "@/db/schema";
import {
  SESSION_TTL_MS,
  authenticate,
  createSession,
  createUser,
  findUserByEmail,
  hashPassword,
  hashToken,
  invalidateSession,
  validateSession,
  verifyPassword,
} from "@/domain/auth";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date(Date.UTC(2026, 10, 1));
const later = (ms: number) => new Date(t0.getTime() + ms);

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^pbkdf2_sha256\$100000\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "x")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$1$a$b")).toBe(false);
  });
});

describe("createUser", () => {
  it("lets an admin add a person with a normalised email", async () => {
    const user = await createUser(db, admin, {
      email: "  Lin@Example.com ",
      name: "Lin Park",
      password: "a long enough password",
      role: "staff",
    });
    expect(user).toMatchObject({ email: "lin@example.com", name: "Lin Park", role: "staff" });
    expect(await authenticate(db, "lin@example.com", "a long enough password")).toMatchObject({ id: user.id });
    const [entry] = await db.select().from(activityLog);
    expect(entry).toMatchObject({ entityType: "user", entityId: user.id, summary: "Added Lin Park as staff" });
  });

  it("is admin-only", async () => {
    await expect(
      createUser(db, staff, { email: "x@example.com", name: "X", password: "a long enough password", role: "staff" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("needs a password of at least 12 characters", async () => {
    await expect(
      createUser(db, admin, { email: "x@example.com", name: "X", password: "short", role: "staff" }),
    ).rejects.toMatchObject({ code: "invalid_input", field: "password" });
  });

  it("reports an email that is already in use", async () => {
    await expect(
      createUser(db, admin, {
        email: "ADA@example.com",
        name: "Ada",
        password: "a long enough password",
        role: "staff",
      }),
    ).rejects.toMatchObject({ code: "conflict", field: "email" });
  });
});

describe("authenticate", () => {
  beforeEach(async () => {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword("a long enough password") })
      .where(eq(users.id, 1));
  });

  it("returns the user for the right email and password, ignoring email case", async () => {
    expect(await authenticate(db, "Ada@Example.com", "a long enough password")).toEqual({
      id: 1,
      email: "ada@example.com",
      name: "Ada Lovelace",
      role: "admin",
    });
  });

  it("returns null for a wrong password or an unknown email", async () => {
    expect(await authenticate(db, "ada@example.com", "wrong password here")).toBeNull();
    expect(await authenticate(db, "nobody@example.com", "a long enough password")).toBeNull();
  });
});

describe("findUserByEmail", () => {
  it("finds a person by email, ignoring case and spaces, without a password", async () => {
    expect(await findUserByEmail(db, " SAM@example.com ")).toEqual({
      id: 2,
      email: "sam@example.com",
      name: "Sam Okafor",
      role: "staff",
    });
    expect(await findUserByEmail(db, "nobody@example.com")).toBeNull();
  });
});

describe("sessions", () => {
  it("stores only the hash of the token", async () => {
    const { token } = await createSession(db, 1, t0);
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(await hashToken(token));
    expect(rows[0].id).not.toContain(token);
    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it("resolves a valid token to its user", async () => {
    const { token } = await createSession(db, 2, t0);
    const result = await validateSession(db, token, later(DAY));
    expect(result).toMatchObject({ user: { id: 2, name: "Sam Okafor", role: "staff" }, renewed: false });
  });

  it("rejects an unknown token", async () => {
    expect(await validateSession(db, "not-a-real-token", t0)).toBeNull();
  });

  it("expires a session after its lifetime and deletes it", async () => {
    const { token } = await createSession(db, 1, t0);
    expect(await validateSession(db, token, later(SESSION_TTL_MS + 1))).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("extends a session that is past half its lifetime", async () => {
    const { token } = await createSession(db, 1, t0);
    const now = later(SESSION_TTL_MS / 2 + DAY);
    const result = await validateSession(db, token, now);
    expect(result?.renewed).toBe(true);
    expect(result?.expiresAt).toEqual(new Date(now.getTime() + SESSION_TTL_MS));
    expect(await validateSession(db, token, later(SESSION_TTL_MS + DAY))).not.toBeNull();
  });

  it("clears out the person's expired sessions when they sign in again", async () => {
    const { token: stale } = await createSession(db, 1, t0);
    const { token: current } = await createSession(db, 1, later(5 * DAY));
    await createSession(db, 2, t0); // someone else's, also expired: not this sign-in's business

    await createSession(db, 1, later(SESSION_TTL_MS + DAY));

    const ids = (await db.select({ id: sessions.id }).from(sessions)).map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain(await hashToken(stale));
    expect(ids).toContain(await hashToken(current));
  });

  it("signs out by deleting the session", async () => {
    const { token } = await createSession(db, 1, t0);
    await invalidateSession(db, token);
    expect(await validateSession(db, token, t0)).toBeNull();
  });
});
