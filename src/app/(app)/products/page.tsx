import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { type StockForecast, getArchivedForecasts, getStockForecasts } from "@/domain/forecast";
import { PageHeader } from "@/components/page-header";
import { TallyPlaceholder } from "@/components/stock";
import { PageTransition, Reveal } from "@/components/transitions";
import { formatDate } from "@/lib/format";
import { getCurrentUser, getSessionUser } from "@/server/dal";
import { getMoneyPrefs } from "@/server/preferences";
import { type ProductRow, ProductTable } from "./product-table";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <PageTransition>
      <PageHeader
        title="Products"
        actions={
          // The header keeps the button's height whoever is signed in, so it never grows
          // when the session arrives.
          <div className="flex h-12 items-end">
            <Suspense>
              <AddProduct />
            </Suspense>
          </div>
        }
      />
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
  const db = await getDb();
  const now = new Date();
  const [active, archived] = await Promise.all([getStockForecasts(db, now), getArchivedForecasts(db, now)]);

  // Only what the table prints crosses to the browser.
  const row = (f: StockForecast): ProductRow => ({
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
    archivedOn: f.archivedAt ? formatDate(f.archivedAt, now) : null,
  });
  const rows = [...active, ...archived].map(row).sort((a, b) => a.name.localeCompare(b.name));
  const categories = [...new Set(rows.flatMap((row) => (row.category ? [row.category] : [])))].sort();

  return <ProductTable rows={rows} categories={categories} money={await getMoneyPrefs()} />;
}

/** Adding a product is an admin's job, so only an admin sees the way in. */
async function AddProduct() {
  const user = await getSessionUser();
  if (user?.role !== "admin") return null;
  return (
    <Link
      href="/products/new"
      prefetch={false}
      scroll={false}
      className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
    >
      <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
        <Plus aria-hidden size={18} strokeWidth={2.5} />
        Add product
      </span>
    </Link>
  );
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
