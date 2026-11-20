import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/database";
import { activityLog, products } from "@/db/schema";
import { createSession } from "@/domain/auth";
import { createDraft } from "@/domain/purchase-orders";
import { createTestDb } from "@/test/db";
import { admin, seedBasics } from "@/test/fixtures";
import { fakeRequest } from "@/test/next-request";
import { saveProduct, setProductArchived } from "./product-actions";
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
  await signInAs(1); // Ada, the admin
});

const sprocket = {
  name: "Sprocket",
  sku: "spr-003",
  category: "Hardware",
  supplierId: "1",
  unitCost: "$1.20",
  unitPrice: "4.5",
  reorderPoint: "25",
  reorderQuantity: "1,000",
  description: "",
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const product = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0];

describe("saveProduct", () => {
  it("adds a product from what was typed, in cents and units, with no stock", async () => {
    const state = await saveProduct({}, form(sprocket));

    expect(state.fields).toBeUndefined();
    expect(state.error).toBeUndefined();
    expect(state.saved?.id).toBe(3);
    expect(await product(3)).toMatchObject({
      sku: "SPR-003",
      name: "Sprocket",
      category: "Hardware",
      supplierId: 1,
      unitCostCents: 120,
      unitPriceCents: 450,
      reorderPoint: 25,
      reorderQuantity: 1000,
      description: null,
      onHand: 0,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("edits a product's details when given its ID", async () => {
    const state = await saveProduct({}, form({ ...sprocket, productId: "1", sku: "WID-001", supplierId: "" }));
    expect(state.saved?.id).toBe(1);
    expect(await product(1)).toMatchObject({ name: "Sprocket", sku: "WID-001", supplierId: null });
    const [entry] = await db.select().from(activityLog);
    expect(entry).toMatchObject({ action: "product.updated", entityId: 1 });
  });

  it("reports every field at fault at once, and keeps what was typed", async () => {
    const typed = { ...sprocket, name: " ", sku: "", unitCost: "1.234", unitPrice: "-4", reorderPoint: "2.5" };
    const state = await saveProduct({}, form(typed));

    expect(state.fields).toEqual({
      name: "Enter a name.",
      sku: "Enter a SKU.",
      unitCost: "Enter the cost in dollars and cents, like 4.50.",
      unitPrice: "Enter the price in dollars and cents, like 4.50.",
      reorderPoint: "Enter a whole number of units, 0 or more.",
    });
    expect(state.values).toMatchObject(typed);
    expect(await db.select().from(products)).toHaveLength(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("puts a SKU that's already taken next to the SKU", async () => {
    const state = await saveProduct({}, form({ ...sprocket, sku: "wid-001" }));
    expect(state.fields).toEqual({ sku: "Another product already uses that SKU." });
  });

  it("puts a limit next to the field that breaks it", async () => {
    const state = await saveProduct({}, form({ ...sprocket, unitPrice: "1000000.01", reorderQuantity: "1000001" }));
    expect(state.fields).toEqual({
      unitPrice: "Keep it to $1,000,000 or less.",
      reorderQuantity: "Keep it to 1,000,000 or fewer.",
    });
  });

  it("refuses staff, saying why", async () => {
    await signInAs(2);
    const state = await saveProduct({}, form(sprocket));
    expect(state.error).toEqual({ message: "Only an admin can add products." });
    expect(await db.select().from(products)).toHaveLength(2);
  });

  it("refuses a product ID that isn't one", async () => {
    const state = await saveProduct({}, form({ ...sprocket, productId: "abc" }));
    expect(state.error).toEqual({ message: "That product doesn't exist." });
  });
});

describe("setProductArchived", () => {
  it("archives and restores a product, refreshing the page each time", async () => {
    const archived = await setProductArchived({}, form({ productId: "1", intent: "archive" }));
    expect(archived.done?.archived).toBe(true);
    expect((await product(1)).archivedAt).toBeInstanceOf(Date);

    const restored = await setProductArchived({}, form({ productId: "1", intent: "restore" }));
    expect(restored.done?.archived).toBe(false);
    expect((await product(1)).archivedAt).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("says which open orders stop an archive", async () => {
    await createDraft(db, admin, { supplierId: 1, lines: [{ productId: 1, quantity: 5 }] });
    const state = await setProductArchived({}, form({ productId: "1", intent: "archive" }));
    expect(state.error?.message).toBe("Widget is on PO-0001, which is still open. Receive or cancel it first.");
    expect((await product(1)).archivedAt).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses staff", async () => {
    await signInAs(2);
    const state = await setProductArchived({}, form({ productId: "1", intent: "archive" }));
    expect(state.error?.message).toBe("Only an admin can archive products.");
  });
});
