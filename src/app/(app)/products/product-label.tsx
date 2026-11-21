import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import type { Database } from "@/db/database";
import type { MovementKind } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { DEFAULT_LEAD_TIME_DAYS, DEMAND_WINDOW_DAYS, type StockForecast, getProductForecast } from "@/domain/forecast";
import { listCategories } from "@/domain/products";
import { poNumber } from "@/domain/purchase-orders";
import { countMovements, listMovements } from "@/domain/stock";
import { listSuppliers } from "@/domain/suppliers";
import { CoverTrack, Tally, TallyPlaceholder } from "@/components/stock";
import { explainStock } from "@/lib/explain";
import { formatChange, formatCount, formatDate, formatDays, formatMargin, formatMoney, formatRate } from "@/lib/format";
import { centsToInput } from "@/lib/parse";
import { getCurrentUser } from "@/server/dal";
import { EditButton, LabelEditor } from "@/components/label-editor";
import { ProductForm } from "./product-form";
import type { SupplierOption } from "./product-values";
import { RecordStock } from "./record-stock";
import { RestoreProduct } from "./restore-product";

/** The ledger shows this many of the newest movements. */
const LEDGER_LIMIT = 50;

/** A product ID from the URL, or a 404 for anything that isn't one. */
export function productId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

/**
 * A product printed as one label: what it is, what's on hand and why its status is
 * what it is, the place to record stock, and the ledger that every number comes from.
 * The drawer and the full page print the same label; `action` is the way out of each.
 * An admin edits its details in place, archives it from there, and restores it here.
 */
export async function ProductLabel({ id, heading, action }: { id: number; heading: "h1" | "h2"; action: ReactNode }) {
  const user = await getCurrentUser();
  await connection();
  const db = await getDb();
  const now = new Date();

  let product: StockForecast;
  try {
    product = await getProductForecast(db, id, now);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const isAdmin = user.role === "admin";
  const canEdit = isAdmin && !product.archivedAt;
  const [movements, total, editing] = await Promise.all([
    listMovements(db, id, { limit: LEDGER_LIMIT }),
    countMovements(db, id),
    canEdit ? editingOptions(db, product.supplierId) : null,
  ]);

  const Title = heading;
  const sub = heading === "h1" ? 2 : 3;
  const Sub = heading === "h1" ? "h2" : "h3";
  const position = product.onHand + product.onOrder;

  const label = (
    <article aria-labelledby="product-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <Title id="product-title" className="print-display text-4xl text-balance sm:text-5xl">
            {product.name}
          </Title>
          <p className="mt-2 text-sm text-ink-2">
            <span className="font-mono text-xs">{product.sku}</span>
            {product.category ? <> · {product.category}</> : null}
            {product.archivedAt ? <> · Archived {formatDate(product.archivedAt, now)}</> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {canEdit ? <EditButton /> : null}
          {action}
        </div>
      </header>

      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name="On hand" value={product.onHand} />
        <Tally
          name="Cover"
          value={
            product.daysOfCover === null ? "–" : product.daysOfCover === 0 ? "None" : formatDays(product.daysOfCover)
          }
        >
          <div className="mt-2.5">
            <CoverTrack daysOfCover={product.daysOfCover} leadTimeDays={product.leadTimeDays} />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">lead {formatDays(product.leadTimeDays)}</p>
        </Tally>
        <Tally name="On order" value={product.onOrder} />
      </dl>

      {/* Frozen stock needs no reorder advice; the archived band below says what applies. */}
      {product.archivedAt ? null : <Status product={product} />}

      <dl className="grid grid-cols-2 gap-px border-b-2 border-ink bg-ink sm:grid-cols-4">
        <Detail name="Demand" value={product.dailyDemand > 0 ? formatRate(product.dailyDemand) : "No sales"}>
          net sales, last {DEMAND_WINDOW_DAYS} days
        </Detail>
        <Detail name="Reorder point" value={`${formatCount(product.reorderPoint)} units`}>
          {formatCount(position)} on hand and on order
        </Detail>
        <Detail name="Reorder quantity" value={`${formatCount(product.reorderQuantity)} units`}>
          the smallest suggested order
        </Detail>
        <Detail
          name="Supplier"
          value={
            product.supplierId !== null && product.supplierName ? (
              <Link
                href={`/suppliers/${product.supplierId}`}
                prefetch={false}
                className="underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              >
                {product.supplierName}
              </Link>
            ) : (
              "None"
            )
          }
        >
          {product.supplierName
            ? `${product.leadTimeDays}‑day lead time`
            : `${product.leadTimeDays}‑day lead time assumed`}
        </Detail>
        <Detail name="Unit cost" value={formatMoney(product.unitCostCents)} />
        <Detail name="Unit price" value={formatMoney(product.unitPriceCents)} />
        <Detail name="Value at cost" value={formatMoney(product.onHand * product.unitCostCents)} />
        <Detail name="Margin" value={formatMargin(product.unitCostCents, product.unitPriceCents)} />
      </dl>

      {product.description ? (
        <p className="max-w-prose border-b-2 border-ink px-5 py-4 text-ink-2 sm:px-8">{product.description}</p>
      ) : null}

      {product.archivedAt ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink px-5 py-4 sm:px-8">
          <p className="min-w-0 flex-1 basis-72 text-sm text-ink-2">
            <strong className="font-bold text-ink">Archived.</strong> Its stock can&apos;t change and it can&apos;t be
            ordered. Its ledger stays as it was{isAdmin ? "" : ", and an admin can restore it"}.
          </p>
          {isAdmin ? <RestoreProduct productId={product.id} /> : null}
        </div>
      ) : (
        <RecordStock productId={product.id} onHand={product.onHand} headingLevel={sub} />
      )}

      <section aria-labelledby="ledger-title" className="pt-5 pb-8">
        <div className="px-5 sm:px-8">
          <Sub id="ledger-title" className="text-lg font-bold">
            Ledger
          </Sub>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            Every change to on hand, newest first. Balance is the running total, so the top line is what&apos;s on hand
            now.
          </p>
        </div>
        {movements.length === 0 ? (
          <p className="mt-4 px-5 font-semibold sm:px-8">
            No movements yet. Stock starts at zero until it&apos;s counted.
          </p>
        ) : (
          <Ledger movements={movements} now={now} />
        )}
        {total > movements.length ? (
          <p className="mt-3 px-5 text-sm text-ink-2 sm:px-8">
            Showing the latest {formatCount(movements.length)} of {formatCount(total)} movements.
          </p>
        ) : null}
      </section>
    </article>
  );

  if (!isAdmin) return label;
  return (
    <LabelEditor
      gone="Archived. It can be restored from its label."
      form={
        editing ? (
          <ProductForm
            productId={product.id}
            defaults={{
              name: product.name,
              sku: product.sku,
              category: product.category ?? "",
              supplierId: product.supplierId === null ? "" : String(product.supplierId),
              unitCost: centsToInput(product.unitCostCents),
              unitPrice: centsToInput(product.unitPriceCents),
              reorderPoint: String(product.reorderPoint),
              reorderQuantity: String(product.reorderQuantity),
              description: product.description ?? "",
            }}
            suppliers={editing.suppliers}
            categories={editing.categories}
            defaultLeadTimeDays={DEFAULT_LEAD_TIME_DAYS}
            headingLevel={heading === "h1" ? 1 : 2}
            action={action}
            archive={{
              productId: product.id,
              name: product.name,
              onHand: product.onHand,
              valueCents: product.onHand * product.unitCostCents,
            }}
          />
        ) : null
      }
    >
      {label}
    </LabelEditor>
  );
}

/**
 * The choices the product form offers: active suppliers (plus the product's own, if it
 * has since been archived, so editing doesn't quietly drop it) and the categories in use.
 */
export async function editingOptions(db: Database, currentSupplierId: number | null = null) {
  const [all, categories] = await Promise.all([listSuppliers(db, { includeArchived: true }), listCategories(db)]);
  const suppliers: SupplierOption[] = all
    .filter((s) => !s.archivedAt || s.id === currentSupplierId)
    .map((s) => ({ id: s.id, name: s.archivedAt ? `${s.name} (archived)` : s.name, leadTimeDays: s.leadTimeDays }));
  return { suppliers, categories };
}

/** Why the product has its status: plain for healthy stock, yellow stock for a reorder, reverse print when out. */
function Status({ product }: { product: StockForecast }) {
  const tone =
    product.status === "out" ? "bg-ink text-label" : product.status === "reorder" ? "bg-stock text-ink" : "text-ink";
  const lead = { out: "Out of stock.", reorder: "Reorder.", ok: "Enough stock." }[product.status];
  return (
    <div className={`border-b-2 border-ink px-5 py-3 sm:px-8 ${tone}`}>
      <p className="max-w-prose text-sm">
        <strong className="font-bold">{lead}</strong> {explainStock(product)}
        {product.suggestedQuantity > 0 ? (
          <>
            {" "}
            Suggested order: <strong className="font-bold">{formatCount(product.suggestedQuantity)} units</strong>,{" "}
            {formatMoney(product.suggestedQuantity * product.unitCostCents)} at cost.
          </>
        ) : null}
      </p>
    </div>
  );
}

/** One boxed field of the details zone. The grid's 1px gaps over ink are the rules between fields. */
function Detail({ name, value, children }: { name: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 bg-label px-5 pt-2.5 pb-3 sm:px-8">
      <dt className="field-name">{name}</dt>
      <dd className="mt-0.5 text-lg font-medium text-pretty break-words">{value}</dd>
      {children ? <dd className="text-xs text-ink-3">{children}</dd> : null}
    </div>
  );
}

const KIND_LABEL: Record<MovementKind, string> = {
  receipt: "Receipt",
  sale: "Sale",
  adjustment: "Count adjustment",
  return: "Return",
  write_off: "Write-off",
};

type Movement = Awaited<ReturnType<typeof listMovements>>[number];

/** The ledger: one row per movement with the running balance after it. */
function Ledger({ movements, now }: { movements: Movement[]; now: Date }) {
  return (
    <table className="mt-4 w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-ink">
          <LedgerTh className="pl-5 sm:pl-8">Date</LedgerTh>
          <LedgerTh className="w-full">Movement</LedgerTh>
          <LedgerTh align="right">Change</LedgerTh>
          <LedgerTh align="right" className="pr-5 sm:pr-8 md:pr-4">
            Balance
          </LedgerTh>
          <LedgerTh className="max-md:hidden md:pr-8">By</LedgerTh>
        </tr>
      </thead>
      <tbody>
        {movements.map((m, index) => (
          <tr key={m.id} className="border-b border-hairline align-top last:border-b-0">
            <td className="py-2.5 pr-4 pl-5 whitespace-nowrap text-ink-2 sm:pl-8">{formatDate(m.occurredAt, now)}</td>
            <td className="py-2.5 pr-4">
              <span className="font-semibold">{KIND_LABEL[m.kind]}</span>
              {m.purchaseOrderId ? (
                <span className="ml-2 font-mono text-xs text-ink-3">{poNumber(m.purchaseOrderId)}</span>
              ) : null}
              {m.note ? <p className="text-ink-3">{m.note}</p> : null}
              {m.userName ? <p className="text-ink-3 md:hidden">{m.userName}</p> : null}
            </td>
            <td className="tabular py-2.5 pr-4 text-right font-semibold">{formatChange(m.quantity)}</td>
            <td
              className={`tabular py-2.5 pr-5 text-right sm:pr-8 md:pr-4 ${index === 0 ? "font-bold" : "text-ink-2"}`}
            >
              {formatCount(m.balance)}
            </td>
            <td className="py-2.5 whitespace-nowrap text-ink-2 max-md:hidden md:pr-8">{m.userName ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LedgerTh({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th scope="col" className={`field-name pt-1 pr-4 pb-2 ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </th>
  );
}

/** The same label, unprinted, in the shape of what will print. */
export function ProductLabelPlaceholder({ action }: { action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-40 bg-liner/70" />
        </div>
        {action}
      </div>
      <TallyPlaceholder names={["On hand", "Cover", "On order"]} />
      <div className="border-b-2 border-ink px-5 py-3 sm:px-8">
        <div className="h-5 w-4/5 bg-liner/70" />
      </div>
      <div className="grid grid-cols-2 gap-px border-b-2 border-ink bg-ink sm:grid-cols-4">
        {[
          "Demand",
          "Reorder point",
          "Reorder quantity",
          "Supplier",
          "Unit cost",
          "Unit price",
          "Value at cost",
          "Margin",
        ].map((name) => (
          <div key={name} className="bg-label px-5 pt-2.5 pb-3 sm:px-8">
            <p className="field-name">{name}</p>
            <div className="mt-1.5 h-5 w-16 bg-liner/70" />
          </div>
        ))}
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
