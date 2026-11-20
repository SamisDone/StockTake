import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { SESSION_TTL_MS, createSession } from "@/domain/auth";
import { createTestDb } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { fakeRequest, redirectOf } from "@/test/next-request";
import { authorize, getCurrentUser, getSessionUser } from "./dal";
import { SESSION_COOKIE } from "./session-cookie";

const request = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof fakeRequest> }));
let db: Database;

vi.mock("next/headers", () => ({ cookies: async () => request.current.cookies }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => request.current.redirect(url) }));
vi.mock("@/db/client", () => ({ getDb: async () => db }));

beforeEach(async () => {
  request.current = fakeRequest();
  ({ db } = await createTestDb());
  await seedBasics(db);
});

async function signInAs(userId: number, at = new Date()) {
  const { token } = await createSession(db, userId, at);
  request.current.cookies.set({ name: SESSION_COOKIE, value: token });
}

describe("getSessionUser", () => {
  it("resolves the cookie to a narrow user, without the password hash", async () => {
    await signInAs(2);
    expect(await getSessionUser()).toEqual({ id: 2, email: "sam@example.com", name: "Sam Okafor", role: "staff" });
  });

  it("is null with no cookie, a junk cookie, or an expired session", async () => {
    expect(await getSessionUser()).toBeNull();

    request.current.cookies.set({ name: SESSION_COOKIE, value: "junk" });
    expect(await getSessionUser()).toBeNull();

    await signInAs(1, new Date(Date.now() - SESSION_TTL_MS - 1000));
    expect(await getSessionUser()).toBeNull();
  });
});

describe("getCurrentUser", () => {
  it("returns the signed-in person", async () => {
    await signInAs(1);
    expect(await getCurrentUser()).toMatchObject({ id: 1, role: "admin" });
  });

  it("sends anyone else to the login page", async () => {
    expect(await redirectOf(getCurrentUser())).toBe("/login");
  });
});

describe("authorize", () => {
  it("gives a Server Action the database and the verified actor", async () => {
    await signInAs(2);
    const { db: given, user } = await authorize();
    expect(given).toBe(db);
    expect(user).toMatchObject({ id: 2, role: "staff" });
  });

  it("stops a signed-out caller before any work happens", async () => {
    expect(await redirectOf(authorize())).toBe("/login");
  });
});
