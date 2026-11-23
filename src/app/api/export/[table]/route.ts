import { getDb } from "@/db/client";
import { readPeriod, periodRange } from "@/domain/analytics";
import { ledgerRows, orderRows, productRows, saleRows, supplierRows } from "@/domain/exports";
import { dayKey } from "@/lib/business-time";
import { csvResponse } from "@/lib/csv";
import { getSessionUser } from "@/server/dal";

/**
 * GET a table as a CSV file: products, suppliers, orders, sales, or the ledger for an analytics
 * period (`?period=28|90`). Anyone signed in can take out what they can see; the session
 * is checked here, next to the data. proxy.ts redirects requests with no cookie at all.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/export/[table]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });

  const { table } = await params;
  const db = await getDb();
  const now = new Date();
  const today = dayKey(now);

  switch (table) {
    case "products":
      return csvResponse(`stocktake-products-${today}.csv`, await productRows(db));
    case "suppliers":
      return csvResponse(`stocktake-suppliers-${today}.csv`, await supplierRows(db));
    case "orders":
      return csvResponse(`stocktake-orders-${today}.csv`, await orderRows(db));
    case "sales":
      return csvResponse(`stocktake-sales-${today}.csv`, await saleRows(db));
    case "ledger": {
      const days = readPeriod(new URL(request.url).searchParams.get("period") ?? undefined);
      const { from, to } = periodRange(days, now);
      return csvResponse(`stocktake-ledger-${dayKey(from)}-to-${today}.csv`, await ledgerRows(db, from, to));
    }
    default:
      return new Response("There's no export by that name.", { status: 404 });
  }
}
