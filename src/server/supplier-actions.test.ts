import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { suppliers } from "@/db/schema";
import { createSession } from "@/domain/auth";
import { createDraft } from "@/domain/purchase-orders";
import { getSupplier } from "@/domain/suppliers";
import { createTestDb } from "@/test/db";
import { seedBasics, staff } from "@/test/fixtures";
import { fakeRequest, redirectOf } from "@/test/next-request";
import { SESSION_COOKIE } from "./session-cookie";
import { removeReview, saveReview, saveSupplier, setSupplierArchived } from "./supplier-actions";

const request = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof fakeRequest> }));
const refresh = vi.hoisted(() => vi.fn());
let db: Database;

vi.mock("next/headers", () => ({ cookies: async () => request.current.cookies }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => request.current.redirect(url) }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@/db/client", () => ({ getDb: async () => db }));

async function signInAs(userId: number) {
  const { token } = await createSession(db, userId);
  request.current.cookies.set({ name: SESSION_COOKIE, value: token });
}

beforeEach(async () => {
  request.current = fakeRequest();
  refresh.mockClear();
  ({ db } = await createTestDb());
  await seedBasics(db);
  await signInAs(1); // Ada, the admin
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const supplier = async (id: number) => (await db.select().from(suppliers).where(eq(suppliers.id, id)))[0];

const copperleaf = { name: "Copperleaf Tools", email: " orders@copperleaf.test ", phone: "", leadTimeDays: "12" };

describe("saveSupplier", () => {
  it("adds a supplier and opens it", async () => {
    expect(await redirectOf(saveSupplier({}, form(copperleaf)))).toBe("/suppliers/2");
    expect(await supplier(2)).toMatchObject({
      name: "Copperleaf Tools",
      email: "orders@copperleaf.test",
      phone: null,
      leadTimeDays: 12,
    });
  });

  it("edits a supplier when given its ID", async () => {
    const state = await saveSupplier({}, form({ ...copperleaf, supplierId: "1", phone: "+1 555 0100" }));
    expect(state.saved?.id).toBe(1);
    expect(await supplier(1)).toMatchObject({ name: "Copperleaf Tools", phone: "+1 555 0100" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("puts every problem next to its field, keeping what was typed", async () => {
    const typed = { name: " ", email: "nope", phone: "", leadTimeDays: "two weeks" };
    const state = await saveSupplier({}, form(typed));
    expect(state.fields).toEqual({
      name: "Enter a name.",
      email: "Enter a valid email address.",
      leadTimeDays: "Enter a whole number of days, 0 or more.",
    });
    expect(state.values).toEqual(typed);
  });

  it("is an admin's job", async () => {
    await signInAs(2);
    const state = await saveSupplier({}, form(copperleaf));
    expect(state.error?.message).toBe("Only an admin can add suppliers.");
  });
});

describe("setSupplierArchived", () => {
  it("archives and restores", async () => {
    expect((await setSupplierArchived({}, form({ supplierId: "1", intent: "archive" }))).done?.archived).toBe(true);
    expect((await supplier(1)).archivedAt).not.toBeNull();
    expect((await setSupplierArchived({}, form({ supplierId: "1", intent: "restore" }))).done?.archived).toBe(false);
    expect((await supplier(1)).archivedAt).toBeNull();
  });

  it("says which open orders stop it", async () => {
    await createDraft(db, staff, { supplierId: 1, lines: [{ productId: 1, quantity: 5 }] });
    const state = await setSupplierArchived({}, form({ supplierId: "1", intent: "archive" }));
    expect(state.error?.message).toBe("Northwind Supply has PO-0001 open. Receive or cancel it first.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("reviews", () => {
  it("lets anyone rate a supplier, then change or remove their review", async () => {
    await signInAs(2);
    expect((await saveReview({}, form({ supplierId: "1", rating: "4", comment: " Quick " }))).done).toBeDefined();
    await saveReview({}, form({ supplierId: "1", rating: "2", comment: "" }));
    expect((await getSupplier(db, 1)).reviews.map((r) => [r.userName, r.rating, r.comment])).toEqual([
      ["Sam Okafor", 2, null],
    ]);

    await removeReview({}, form({ supplierId: "1" }));
    expect((await getSupplier(db, 1)).reviews).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("asks for a rating", async () => {
    const state = await saveReview({}, form({ supplierId: "1", rating: "", comment: "Fine" }));
    expect(state.fields).toEqual({ rating: "Choose 1 to 5 stars." });
    expect(state.values).toEqual({ rating: "", comment: "Fine" });
  });
});
