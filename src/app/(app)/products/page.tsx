import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getStockForecasts } from "@/domain/forecast";
import { PageHeader } from "@/components/page-header";
import { TallyPlaceholder } from "@/components/stock";
import { PageTransition, Reveal } from "@/components/transitions";
import { getCurrentUser } from "@/server/dal";
import { type ProductRow, ProductTable } from "./product-table";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <PageTransition>
      <PageHeader title="Products" />
      <Reveal fallback={<ListPlaceholder />}>
        <ProductList />
      </Reveal>
    </PageTransition>
  );
}

async function ProductList() {
  await getCurrentUser();
  // Cover is relative to now, so it belongs to the request, never to a prerender.
  await connection();
  const forecasts = await getStockForecasts(await getDb());

  // Only what the table prints crosses to the browser.
  const rows: ProductRow[] = forecasts
    .map((f) => ({
      id: f.id,
      sku: f.sku,
      name: f.name,
      category: f.category,
      status: f.status,
      onHand: f.onHand,
      reorderPoint: f.reorderPoint,
      daysOfCover: f.daysOfCover,
      leadTimeDays: f.leadTimeDays,
      valueCents: f.onHand * f.unitCostCents,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const categories = [...new Set(rows.flatMap((row) => (row.category ? [row.category] : [])))].sort();

  return <ProductTable rows={rows} categories={categories} />;
}

/** The same label, unprinted: the filter fields, the tallies and the rows hold their space. */
function ListPlaceholder() {
  return (
    <div aria-hidden>
      <div className="grid border-b-2 border-ink lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)_auto]">
        {["Search", "Category", "Show"].map((name) => (
          <div
            key={name}
            className="border-b border-ink px-5 pt-2.5 pb-3 last:border-b-0 sm:px-8 lg:border-b-0 lg:border-l lg:first:border-l-0"
          >
            <p className="field-name">{name}</p>
            <div className="mt-1.5 h-8 bg-liner/70" />
          </div>
        ))}
      </div>
      <TallyPlaceholder names={["Products", "Units on hand", "Value at cost"]} />
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
