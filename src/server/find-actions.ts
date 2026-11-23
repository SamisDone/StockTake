"use server";

import { listCustomers } from "@/domain/customers";
import { listProducts } from "@/domain/products";
import { listOrders } from "@/domain/purchase-orders";
import { listSuppliers } from "@/domain/suppliers";
import { authorize } from "./dal";

/** What the command palette and the record sheet search: small enough to send whole. */
export type FindIndex = Awaited<ReturnType<typeof findIndex>>;

/**
 * Every record a person can jump to, trimmed to what a search row prints. The demo
 * catalog is a few dozen products, six suppliers, a hundred-odd orders and a handful of customers, so one read
 * on opening beats a request per keystroke; the client filters it as you type.
 */
export async function findIndex() {
  const { db } = await authorize();
  const [products, suppliers, orders, customers] = await Promise.all([
    listProducts(db),
    listSuppliers(db),
    listOrders(db),
    listCustomers(db),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, onHand: p.onHand, category: p.category })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    orders: orders.map((o) => ({ id: o.id, number: o.number, supplierName: o.supplierName, status: o.status })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
  };
}
