import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { products, purchaseOrders } from "@/db/schema";
import { createSession } from "@/domain/auth";
import { createDraft, placeOrder } from "@/domain/purchase-orders";
import { createTestDb } from "@/test/db";
import { admin, seedBasics, staff } from "@/test/fixtures";
import { fakeRequest, redirectOf } from "@/test/next-request";
import { changeOrder, draftFromSuggestions } from "./order-actions";
import { SESSION_COOKIE } from "./session-cookie";

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
  await signInAs(2); // Sam, staff
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const status = async (id: number) =>
  (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)))[0].status;

describe("draftFromSuggestions", () => {
  it("drafts the supplier's suggested order and opens it", async () => {
    expect(await redirectOf(draftFromSuggestions({}, form({ supplierId: "1" })))).toBe("/orders/1");
    expect(await status(1)).toBe("draft");
  });

  it("says why when there's nothing left to draft", async () => {
    await redirectOf(draftFromSuggestions({}, form({ supplierId: "1" })));
    const state = await draftFromSuggestions({}, form({ supplierId: "1" }));
    expect(state.error?.message).toBe("Everything Northwind Supply should send is on a draft already.");
  });

  it("refuses a supplier ID that isn't one", async () => {
    const state = await draftFromSuggestions({}, form({ supplierId: "x" }));
    expect(state.error?.message).toBe("That supplier doesn't exist.");
  });
});

describe("changeOrder", () => {
  const twoLines = {
    supplierId: 1,
    lines: [
      { productId: 1, quantity: 30 },
      { productId: 2, quantity: 10 },
    ],
  };

  it("lets staff receive a placed order, booking the stock", async () => {
    const { id } = await createDraft(db, staff, twoLines);
    await placeOrder(db, admin, id);

    const state = await changeOrder({}, form({ orderId: String(id), intent: "receive" }));
    expect(state.done?.message).toBe("Received PO-0001: 40 units booked into stock.");
    expect(await status(id)).toBe("received");
    const [widget] = await db.select().from(products).where(eq(products.id, 1));
    expect(widget.onHand).toBe(30);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps placing and cancelling for admins", async () => {
    const { id } = await createDraft(db, staff, twoLines);
    expect((await changeOrder({}, form({ orderId: String(id), intent: "place" }))).error?.message).toBe(
      "Only an admin can place purchase orders.",
    );

    await signInAs(1);
    expect((await changeOrder({}, form({ orderId: String(id), intent: "place" }))).done?.message).toBe(
      "Placed PO-0001 with Northwind Supply.",
    );
    expect((await changeOrder({}, form({ orderId: String(id), intent: "cancel" }))).done?.message).toBe(
      "Cancelled PO-0001.",
    );
    expect(await status(id)).toBe("cancelled");
  });

  it("says what state stops a change", async () => {
    const { id } = await createDraft(db, staff, twoLines);
    const state = await changeOrder({}, form({ orderId: String(id), intent: "receive" }));
    expect(state.error?.message).toBe("PO-0001 hasn't been placed yet.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses an unknown change", async () => {
    const state = await changeOrder({}, form({ orderId: "1", intent: "delete" }));
    expect(state.error?.message).toBe("Choose what to do with the order.");
  });
});
