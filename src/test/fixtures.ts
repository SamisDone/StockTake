import type { Database } from "@/db/database";
import { products, suppliers, users } from "@/db/schema";
import type { Actor } from "@/domain/actor";

export const admin: Actor = { id: 1, role: "admin" };
export const staff: Actor = { id: 2, role: "staff" };

/** Two people, one supplier, and two products with no stock. */
export async function seedBasics(db: Database) {
  await db.insert(users).values([
    { id: 1, email: "ada@example.com", name: "Ada Lovelace", passwordHash: "x", role: "admin" },
    { id: 2, email: "sam@example.com", name: "Sam Okafor", passwordHash: "x", role: "staff" },
  ]);
  await db.insert(suppliers).values({ id: 1, name: "Northwind Supply", leadTimeDays: 7 });
  await db.insert(products).values([
    {
      id: 1,
      sku: "WID-001",
      name: "Widget",
      supplierId: 1,
      unitCostCents: 250,
      unitPriceCents: 900,
      reorderPoint: 10,
      reorderQuantity: 50,
    },
    {
      id: 2,
      sku: "GAD-002",
      name: "Gadget",
      supplierId: 1,
      unitCostCents: 400,
      unitPriceCents: 1500,
      reorderPoint: 5,
      reorderQuantity: 20,
    },
  ]);
}
