import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { getOrderableProducts } from "@/domain/reorder";
import { listSuppliers } from "@/domain/suppliers";
import { getCurrentUser } from "@/server/dal";
import { DraftForm } from "./draft-form";
import { type SupplierChoice, dayInput } from "./draft-values";

/**
 * A blank order to write by hand. Anyone can draft one; an admin places it. Only
 * suppliers with something to order are offered.
 */
export async function NewOrder({ action }: { action: ReactNode }) {
  await getCurrentUser();
  // The forecast behind each new line's quantity is relative to now.
  await connection();
  const db = await getDb();
  const now = new Date();
  const [all, products] = await Promise.all([listSuppliers(db), getOrderableProducts(db, now)]);

  const stocked = new Set(products.map((p) => p.supplierId));
  const suppliers: SupplierChoice[] = all
    .filter((s) => stocked.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, leadTimeDays: s.leadTimeDays }));

  return (
    <DraftForm
      suppliers={suppliers}
      products={products}
      defaults={{ supplierId: "", lines: [], expectedAt: "", notes: "" }}
      today={dayInput(now)}
      action={action}
    />
  );
}

/** The blank order, unprinted: its header, the supplier box and the lines hold their space. */
export function NewOrderPlaceholder({ action }: { action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">New order</p>
          <div className="mt-2 h-4 w-3/5 bg-liner/70" />
        </div>
        {action}
      </div>
      <div className="border-t-2 border-ink bg-label px-5 pt-2.5 pb-3 sm:px-8">
        <p className="field-name">Supplier</p>
        <div className="mt-1.5 h-6 w-48 bg-liner/70" />
      </div>
      <div className="border-t-2 border-ink px-5 pt-5 pb-4 sm:px-8">
        <p className="text-lg font-bold">Lines</p>
        <div className="mt-3 h-11 bg-liner/70" />
      </div>
      <div className="h-[4.25rem] bg-ink sm:h-[4.5rem]" />
    </div>
  );
}
