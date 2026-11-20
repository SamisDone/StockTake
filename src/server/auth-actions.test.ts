import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { sessions, users } from "@/db/schema";
import { hashPassword, hashToken, validateSession } from "@/domain/auth";
import { createTestDb } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { fakeRequest, redirectOf } from "@/test/next-request";
import { signIn, signOut } from "./auth-actions";
import { SESSION_COOKIE } from "./session-cookie";

const request = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof fakeRequest> }));
let db: Database;

vi.mock("next/headers", () => ({ cookies: async () => request.current.cookies }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => request.current.redirect(url) }));
vi.mock("@/db/client", () => ({ getDb: async () => db }));

const PASSWORD = "correct horse battery";

beforeEach(async () => {
  request.current = fakeRequest();
  ({ db } = await createTestDb());
  await seedBasics(db);
  await db.update(users).set({ passwordHash: await hashPassword(PASSWORD) });
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("signIn", () => {
  it("starts a session, sets the cookie, and goes to the dashboard", async () => {
    const to = await redirectOf(signIn({}, form({ email: " Ada@Example.com ", password: PASSWORD })));
    expect(to).toBe("/dashboard");

    const cookie = request.current.jar.get(SESSION_COOKIE)!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(await validateSession(db, cookie.value)).toMatchObject({ user: { id: 1, role: "admin" } });
    const [row] = await db.select().from(sessions);
    expect(row.id).toBe(await hashToken(cookie.value));
  });

  it("returns to the page the person was sent away from", async () => {
    const to = await redirectOf(signIn({}, form({ email: "sam@example.com", password: PASSWORD, next: "/orders/3" })));
    expect(to).toBe("/orders/3");
  });

  it("ignores a next that points off the site", async () => {
    const to = await redirectOf(
      signIn({}, form({ email: "sam@example.com", password: PASSWORD, next: "//evil.example" })),
    );
    expect(to).toBe("/dashboard");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await signIn({}, form({ email: "ada@example.com", password: "not it at all" }));
    const unknown = await signIn({}, form({ email: "nobody@example.com", password: PASSWORD }));
    expect(wrong.error).toEqual(unknown.error);
    expect(wrong).toEqual({
      error: { message: "That email and password don't match an account." },
      values: { email: "ada@example.com" },
    });
    expect(request.current.jar.size).toBe(0);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("points at the empty field and keeps what was typed", async () => {
    expect(await signIn({}, form({ email: "ada@example.com", password: "" }))).toEqual({
      error: { message: "Enter your password.", field: "password" },
      values: { email: "ada@example.com" },
    });
    expect(await signIn({}, form({ email: "  ", password: PASSWORD }))).toMatchObject({
      error: { field: "email" },
    });
  });
});

describe("signOut", () => {
  it("deletes the session and the cookie, then goes to the login page", async () => {
    await redirectOf(signIn({}, form({ email: "ada@example.com", password: PASSWORD })));
    const token = request.current.jar.get(SESSION_COOKIE)!.value;

    expect(await redirectOf(signOut())).toBe("/login");
    expect(request.current.jar.has(SESSION_COOKIE)).toBe(false);
    expect(await validateSession(db, token)).toBeNull();
  });

  it("still clears a junk cookie", async () => {
    request.current.cookies.set({ name: SESSION_COOKIE, value: "junk" });
    expect(await redirectOf(signOut())).toBe("/login");
    expect(request.current.jar.has(SESSION_COOKIE)).toBe(false);
  });
});
