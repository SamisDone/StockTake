import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { DEFAULT_LEAD_TIME_DAYS } from "@/domain/forecast";
import { getCurrentUser } from "@/server/dal";
import { ProductForm } from "./product-form";
import { editingOptions } from "./product-label";
import { EMPTY_PRODUCT } from "./product-values";

/**
 * A blank product label to fill in. Adding products is an admin's job, so anyone else
 * is told so plainly, with what they can do instead.
 */
export async function NewProduct({ heading, action }: { heading: 1 | 2; action: ReactNode }) {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    const Title = heading === 1 ? "h1" : "h2";
    return (
      <div>
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
          <Title id="product-title" className="print-display text-4xl text-balance sm:text-5xl">
            New product
          </Title>
          {action}
        </header>
        <p className="max-w-prose px-5 py-5 text-ink-2 sm:px-8">
          Only an admin can add products. You can count, sell, return and write off stock from any product&apos;s label.
        </p>
      </div>
    );
  }

  const { suppliers, categories } = await editingOptions(await getDb());
  return (
    <ProductForm
      defaults={EMPTY_PRODUCT}
      suppliers={suppliers}
      categories={categories}
      defaultLeadTimeDays={DEFAULT_LEAD_TIME_DAYS}
      headingLevel={heading}
      action={action}
    />
  );
}

/** The blank label, unprinted: its header and the boxed fields hold their space. */
export function NewProductPlaceholder({ action }: { action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-6 w-32 bg-liner" />
          <div className="mt-2 h-4 w-4/5 bg-liner/70" />
        </div>
        {action}
      </div>
      <div className="grid grid-cols-2 gap-px border-y-2 border-ink bg-ink">
        {["Name", "SKU", "Category", "Supplier", "Unit cost", "Unit price", "Reorder point", "Reorder quantity"].map(
          (name, i) => (
            <div
              key={name}
              className={`bg-label px-5 pt-2.5 pb-3 sm:px-8 ${i === 0 || i === 3 ? "col-span-2" : i < 3 ? "max-sm:col-span-2" : ""}`}
            >
              <p className="field-name">{name}</p>
              <div className={`mt-1.5 bg-liner/70 ${i === 0 ? "h-9" : "h-6"}`} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
