import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { products, stockMovements } from "@/db/schema";
import { createSession } from "@/domain/auth";
import { createTestDb } from "@/test/db";
import { seedBasics } from "@/test/fixtures";
import { fakeRequest, redirectOf } from "@/test/next-request";
import { SESSION_COOKIE } from "./session-cookie";
import { recordStock } from "./stock-actions";

const request = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof fakeRequest> }));
const refresh = vi.hoisted(() => vi.fn());
let db: Database;

vi.mock("next/headers", () => ({ cookies: async () => request.current.cookies }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => request.current.redirect(url) }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@/db/client", () => ({ getDb: async () => db }));

beforeEach(async () => {
  request.current = fakeRequest();
  refresh.mockClear();
  ({ db } = await createTestDb());
  await seedBasics(db);
  // Sam (staff) is signed in.
  const { token } = await createSession(db, 2);
  request.current.cookies.set({ name: SESSION_COOKIE, value: token });
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ productId: "1", ...fields })) data.set(name, value);
  return data;
}

const onHand = async () => (await db.select().from(products).where(eq(products.id, 1)))[0].onHand;

describe("recordStock", () => {
  it("records a count as an adjustment, as the signed-in person, and refreshes the page", async () => {
    const state = await recordStock({}, form({ kind: "count", quantity: "1,200", note: "Aisle 3" }));

    expect(state.error).toBeUndefined();
    expect(state.done?.message).toBe("Counted 1,200, so the ledger was adjusted by +1,200.");
    expect(state.values).toEqual({ kind: "count" });
    expect(await onHand()).toBe(1200);
    const [movement] = await db.select().from(stockMovements);
    expect(movement).toMatchObject({ kind: "adjustment", quantity: 1200, note: "Aisle 3", userId: 2 });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("says when a count matches, without a movement", async () => {
    const state = await recordStock({}, form({ kind: "count", quantity: "0" }));
    expect(state.done?.message).toBe("Counted 0, which matches.");
    expect(await db.select().from(stockMovements)).toHaveLength(0);
  });

  it("records a sale and reports what's left", async () => {
    await recordStock({}, form({ kind: "count", quantity: "10" }));
    const state = await recordStock({}, form({ kind: "sale", quantity: "3" }));
    expect(state.done?.message).toBe("Recorded a sale of 3. 7 on hand.");
    expect(await onHand()).toBe(7);
  });

  it("puts a sale of more than is on hand next to the quantity, and keeps what was typed", async () => {
    await recordStock({}, form({ kind: "count", quantity: "2" }));
    refresh.mockClear();
    const state = await recordStock({}, form({ kind: "write_off", quantity: "5", note: "Crushed" }));

    expect(state.error).toEqual({ message: "Only 2 × Widget on hand.", field: "quantity" });
    expect(state.values).toEqual({ kind: "write_off", quantity: "5", note: "Crushed" });
    expect(await onHand()).toBe(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses quantities that aren't whole units", async () => {
    for (const quantity of ["", "2.5", "-1", "abc", "1000001"]) {
      const state = await recordStock({}, form({ kind: "sale", quantity }));
      expect(state.error?.field).toBe("quantity");
    }
    expect((await recordStock({}, form({ kind: "return", quantity: "0" }))).error?.field).toBe("quantity");
    expect(await db.select().from(stockMovements)).toHaveLength(0);
  });

  it("refuses an unknown kind or product", async () => {
    expect((await recordStock({}, form({ kind: "receipt", quantity: "4" }))).error?.message).toBe(
      "Choose what you're recording.",
    );
    expect((await recordStock({}, form({ kind: "sale", quantity: "4", productId: "99" }))).error?.message).toBe(
      "That product doesn't exist.",
    );
  });

  it("sends someone who isn't signed in to the login page", async () => {
    request.current.jar.clear();
    expect(await redirectOf(recordStock({}, form({ kind: "sale", quantity: "1" })))).toBe("/login");
  });
});
