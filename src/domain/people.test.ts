import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, sessions, users } from "@/db/schema";
import { authenticate, createSession, hashPassword, hashToken } from "@/domain/auth";
import { addPerson, changeOwnPassword, listTeam, resetPassword, setRole, temporaryPassword } from "@/domain/people";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
  await seedBasics(db);
});

async function lastActivity() {
  const [row] = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(1);
  return row;
}

async function addDemoAdmin() {
  await db.insert(users).values({
    id: 9,
    email: "admin@stocktake.demo",
    name: "Avery Chen",
    passwordHash: "x",
    role: "admin",
  });
}

describe("temporaryPassword", () => {
  it("is twelve clear characters in three groups", () => {
    for (let i = 0; i < 50; i++) expect(temporaryPassword()).toMatch(/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){2}$/);
  });
});

describe("listTeam", () => {
  it("lists admins first, then by name, and marks the demo accounts", async () => {
    await addDemoAdmin();
    const team = await listTeam(db);
    expect(team.map((p) => [p.name, p.role, p.demo])).toEqual([
      ["Ada Lovelace", "admin", false],
      ["Avery Chen", "admin", true],
      ["Sam Okafor", "staff", false],
    ]);
  });
});

describe("addPerson", () => {
  it("adds someone who can sign in with the temporary password", async () => {
    const { person, password } = await addPerson(db, admin, {
      name: "Rin Tanaka",
      email: "Rin@Example.com",
      role: "staff",
    });
    expect(person).toMatchObject({ name: "Rin Tanaka", email: "rin@example.com", role: "staff" });
    expect(await authenticate(db, "rin@example.com", password)).toMatchObject({ id: person.id });
  });

  it("is for admins", async () => {
    await expect(addPerson(db, staff, { name: "Rin", email: "rin@example.com", role: "staff" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("setRole", () => {
  it("changes a role and logs it", async () => {
    expect(await setRole(db, admin, 2, "admin")).toEqual({ name: "Sam Okafor", role: "admin" });
    const [sam] = await db.select().from(users).where(eq(users.id, 2));
    expect(sam.role).toBe("admin");
    expect(await lastActivity()).toMatchObject({ action: "user.role_changed", summary: "Made Sam Okafor an admin" });
  });

  it("won't change your own role", async () => {
    await expect(setRole(db, admin, 1, "staff")).rejects.toThrow("can't change your own role");
  });

  it("keeps the demo accounts as they are", async () => {
    await addDemoAdmin();
    await expect(setRole(db, admin, 9, "staff")).rejects.toThrow("demo accounts stay as they are");
  });

  it("is for admins", async () => {
    await expect(setRole(db, staff, 1, "staff")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("reports someone who isn't on the team", async () => {
    await expect(setRole(db, admin, 99, "staff")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("resetPassword", () => {
  it("gives a new temporary password and signs the person out everywhere", async () => {
    await createSession(db, 2);
    const { name, password } = await resetPassword(db, admin, 2);
    expect(name).toBe("Sam Okafor");
    expect(await authenticate(db, "sam@example.com", password)).toMatchObject({ id: 2 });
    expect(await db.select().from(sessions).where(eq(sessions.userId, 2))).toHaveLength(0);
    expect(await lastActivity()).toMatchObject({
      action: "user.password_reset",
      summary: "Reset Sam Okafor's password",
    });
  });

  it("sends you to Your password for your own", async () => {
    await expect(resetPassword(db, admin, 1)).rejects.toThrow("Your password");
  });

  it("keeps the demo accounts' public password", async () => {
    await addDemoAdmin();
    await expect(resetPassword(db, admin, 9)).rejects.toThrow("demo accounts stay as they are");
  });
});

describe("changeOwnPassword", () => {
  beforeEach(async () => {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword("old password here") })
      .where(eq(users.id, 2));
  });

  it("changes it given the current one, ending your other sessions but not this one", async () => {
    const here = await createSession(db, 2);
    await createSession(db, 2);
    const hereId = await hashToken(here.token);

    await changeOwnPassword(db, staff, { current: "old password here", next: "a much newer password" }, hereId);

    expect(await authenticate(db, "sam@example.com", "a much newer password")).toMatchObject({ id: 2 });
    const left = await db.select().from(sessions).where(eq(sessions.userId, 2));
    expect(left.map((s) => s.id)).toEqual([hereId]);
  });

  it("needs the current password", async () => {
    await expect(
      changeOwnPassword(db, staff, { current: "wrong", next: "a much newer password" }, "x"),
    ).rejects.toMatchObject({ code: "invalid_input", field: "current" });
  });

  it("needs at least 12 characters", async () => {
    await expect(
      changeOwnPassword(db, staff, { current: "old password here", next: "short" }, "x"),
    ).rejects.toMatchObject({ field: "next" });
  });
});
