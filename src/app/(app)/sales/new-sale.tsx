import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { listCustomers } from "@/domain/customers";
import { listProducts } from "@/domain/products";
import type { Language } from "@/lib/i18n";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { SALES_COPY } from "./copy";
import { SaleForm } from "./sale-form";

/**
 * A blank sale to write. Anyone can sell. Every active product is offered with what's on
 * its shelf; `?customer=ID` (a customer's label links here) arrives with them chosen.
 */
export async function NewSale({
  action,
  searchParams,
}: {
  action: ReactNode;
  searchParams: PageProps<"/sales/new">["searchParams"];
}) {
  await getCurrentUser();
  const language = await getLanguage();
  const { customer: wanted } = await searchParams;
  await connection();
  const db = await getDb();
  const [products, customers, money] = await Promise.all([listProducts(db), listCustomers(db), getMoneyPrefs()]);
  const chosen = customers.find((c) => String(c.id) === wanted);

  return (
    <SaleForm
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        onHand: p.onHand,
        priceCents: p.unitPriceCents,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name, dueCents: c.dueCents }))}
      defaultCustomerId={chosen?.id ?? null}
      money={money}
      language={language}
      action={action}
    />
  );
}

/** The blank sale, unprinted: its header and fields hold their space. */
export function NewSalePlaceholder({ language, action }: { language: Language; action?: ReactNode }) {
  const t = SALES_COPY[language].form;
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <p className="print-display text-2xl sm:text-3xl">{t.title}</p>
          <div className="mt-2 h-4 w-4/5 bg-liner/70" />
        </div>
        {action}
      </div>
      <div className="border-y-2 border-ink px-5 pt-2.5 pb-3 sm:px-8">
        <p className="field-name">{t.customer}</p>
        <div className="mt-1.5 h-7 w-56 bg-liner/70" />
      </div>
      <div className="space-y-3 px-5 pt-5 sm:px-8">
        <div className="h-5 w-16 bg-liner" />
        <div className="h-11 bg-liner/70" />
      </div>
    </div>
  );
}
