import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getStockForecasts } from "@/domain/forecast";
import { deliveryRecord, listOrders, poNumber } from "@/domain/purchase-orders";
import { getReorderSuggestions } from "@/domain/reorder";
import { getSupplier } from "@/domain/suppliers";
import { EditButton, LabelEditor } from "@/components/label-editor";
import { Stars, formatRating } from "@/components/stars";
import { CoverBar, MobileName, StatusMark, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/server/dal";
import { DraftButton } from "../orders/draft-button";
import { STATUS_WORD, orderWhen } from "../orders/status";
import { RestoreSupplier } from "./restore-supplier";
import { ReviewForm } from "./review-form";
import { SupplierForm } from "./supplier-form";

/**
 * Four tallies: two by two on a phone, where the third starts a row and so takes a top
 * rule, not a side one; one row from `sm`. Shared with the placeholder so it never jumps.
 */
const FOUR_TALLIES =
  "grid-cols-2 sm:grid-cols-4 max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t";

/** The label lists this many of the supplier's newest orders. */
const ORDER_LIMIT = 8;

/** A supplier ID from the URL, or a 404 for anything that isn't one. */
export function supplierId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

type Supplier = Awaited<ReturnType<typeof getSupplier>>;

/**
 * A supplier printed as one label: how to reach them, how they're doing (lead time,
 * deliveries on time, what people rate them), what of theirs needs ordering and the
 * way to draft it, their products, their orders, and the reviews. An admin edits the
 * details in place, archives from there, and restores here.
 */
export async function SupplierLabel({ id, action }: { id: number; action: ReactNode }) {
  const user = await getCurrentUser();
  await connection();
  const db = await getDb();
  const now = new Date();

  let supplier: Supplier;
  try {
    supplier = await getSupplier(db, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const [forecasts, orders] = await Promise.all([getStockForecasts(db, now), listOrders(db, { supplierId: id })]);
  const { suppliers: groups } = await getReorderSuggestions(db, now, forecasts);
  const products = forecasts.filter((f) => f.supplierId === id);
  const low = products.filter((p) => p.status !== "ok").length;
  const suggestion = groups.find((g) => g.supplierId === id);
  const record = deliveryRecord(orders);
  const isAdmin = user.role === "admin";
  const canEdit = isAdmin && !supplier.archivedAt;
  const mine = supplier.reviews.find((r) => r.userId === user.id);
  const others = supplier.reviews.filter((r) => r.userId !== user.id);

  const label = (
    <article aria-labelledby="supplier-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="supplier-title" className="print-display text-4xl text-balance sm:text-5xl">
            {supplier.name}
          </h1>
          {/* One line at the desk; on a phone each part takes its own line, so none breaks. */}
          <p className="mt-2 text-sm text-ink-2">
            {[
              supplier.email ? (
                <a
                  key="email"
                  href={`mailto:${supplier.email}`}
                  className="underline decoration-ink-3 underline-offset-4 hover:decoration-ink max-sm:table"
                >
                  {supplier.email}
                </a>
              ) : null,
              supplier.phone ? (
                <a
                  key="phone"
                  href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`}
                  className="whitespace-nowrap underline decoration-ink-3 underline-offset-4 hover:decoration-ink max-sm:table"
                >
                  {supplier.phone}
                </a>
              ) : null,
              supplier.archivedAt ? (
                <span key="archived" className="whitespace-nowrap max-sm:block">
                  Archived {formatDate(supplier.archivedAt, now)}
                </span>
              ) : null,
            ]
              .filter(Boolean)
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <span key={`dot-${i}`} aria-hidden className="max-sm:hidden">
                        {" · "}
                      </span>,
                      part,
                    ],
              )}
            {!supplier.email && !supplier.phone && !supplier.archivedAt ? "No contact details" : null}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {canEdit ? <EditButton /> : null}
          {action}
        </div>
      </header>
      <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
        <Tally
          name="Lead time"
          value={`${formatCount(supplier.leadTimeDays)} ${supplier.leadTimeDays === 1 ? "day" : "days"}`}
        />
        <Tally name="Products" value={products.length}>
          <p className="mt-1 text-sm text-ink-2">{low > 0 ? `${formatCount(low)} running low` : "None running low"}</p>
        </Tally>
        <Tally
          name="On time"
          value={record.received === 0 ? "–" : `${Math.round((record.onTime / record.received) * 100)}%`}
        >
          <p className="mt-1 text-sm text-ink-2">
            {record.received === 0
              ? "Nothing received yet"
              : `${formatCount(record.onTime)} of ${formatCount(record.received)} by the due day`}
          </p>
        </Tally>
        <Tally name="Rating" value={supplier.averageRating === null ? "–" : formatRating(supplier.averageRating)}>
          {supplier.averageRating === null ? (
            <p className="mt-1 text-sm text-ink-2">No reviews</p>
          ) : (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
              <Stars rating={supplier.averageRating} size={14} />
              {formatCount(supplier.reviewCount)} {supplier.reviewCount === 1 ? "review" : "reviews"}
            </p>
          )}
        </Tally>
      </dl>

      <Status supplier={supplier} suggestion={suggestion} isAdmin={isAdmin} />

      <section aria-labelledby="products-title" className="border-b-2 border-ink pt-5 pb-6">
        <div className="px-5 sm:px-8">
          <h2 id="products-title" className="text-lg font-bold">
            Products
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            What {supplier.name} supplies, most urgent first. Cover is measured against their{" "}
            {formatCount(supplier.leadTimeDays)}‑day lead time.
          </p>
        </div>
        {products.length === 0 ? (
          <p className="mt-4 px-5 font-semibold sm:px-8">No active products come from {supplier.name}.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-left max-md:block">
            <caption className="sr-only">{formatCount(products.length)} products, most urgent first.</caption>
            <thead className="max-md:hidden">
              <tr className="border-b border-ink">
                <Th className="w-full">Product</Th>
                <Th align="right" className="whitespace-nowrap">
                  On hand
                </Th>
                <Th className="min-w-56">Cover</Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="relative border-b border-hairline align-top transition-colors duration-150 last:border-b-0 hover:bg-liner/60 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-6 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8"
                >
                  <td className="py-3 pr-4 max-md:col-span-2 max-md:p-0 md:pl-8">
                    <div className="flex items-baseline gap-2">
                      <StatusMark status={p.status} />
                      <Link
                        href={`/products/${p.id}`}
                        prefetch={false}
                        className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-ink-3">{p.sku}</p>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap max-md:p-0 md:text-right">
                    <MobileName>On hand</MobileName>
                    <span className="tabular">{formatCount(p.onHand)}</span>
                  </td>
                  <td className="py-3 max-md:p-0 md:pr-8">
                    <MobileName>Cover</MobileName>
                    <CoverBar daysOfCover={p.daysOfCover} leadTimeDays={p.leadTimeDays} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="orders-title" className="border-b-2 border-ink pt-5 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 sm:px-8">
          <div className="min-w-0">
            <h2 id="orders-title" className="text-lg font-bold">
              Orders
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {orders.length === 0
                ? `Nothing has been ordered from ${supplier.name} yet.`
                : orders.length > ORDER_LIMIT
                  ? `The latest ${ORDER_LIMIT} of ${formatCount(orders.length)}, newest first.`
                  : "Newest first."}
            </p>
          </div>
          {supplier.archivedAt ? null : (
            <Link
              href={`/orders/new?supplier=${supplier.id}`}
              prefetch={false}
              transitionTypes={NAV_FORWARD}
              className="press-quiet -mr-3 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner"
            >
              <Plus aria-hidden size={18} strokeWidth={2.25} />
              New order
            </Link>
          )}
        </div>
        {orders.length > 0 ? (
          <ul className="mt-3 border-t border-ink">
            {orders.slice(0, ORDER_LIMIT).map((o) => {
              const late = o.dueAt !== null && o.dueAt < now;
              return (
                <li
                  key={o.id}
                  className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-3 transition-colors duration-150 last:border-b-0 hover:bg-liner/60 sm:px-8"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    {late ? (
                      <span className="shrink-0 rounded-mark bg-stock px-1.5 py-px text-xs font-bold">Late</span>
                    ) : null}
                    <Link
                      href={`/orders/${o.id}`}
                      prefetch={false}
                      transitionTypes={NAV_FORWARD}
                      className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                    >
                      {o.number}
                    </Link>
                    <span className="text-sm text-ink-2">
                      {/* The date phrase names the state ("Received Nov 19"); only "Due" needs "Placed". */}
                      {o.status === "ordered" ? `${STATUS_WORD.ordered} · ` : null}
                      {orderWhen(o, now)}
                    </span>
                  </div>
                  <span className="tabular font-semibold">{formatMoney(o.totalCents)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="reviews-title" className="pt-5 pb-8">
        <div className="px-5 sm:px-8">
          <h2 id="reviews-title" className="text-lg font-bold">
            Reviews
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            One per person, from the people who order from and receive from them. Yours replaces your last one.
          </p>
        </div>
        <ReviewForm
          supplierId={supplier.id}
          supplierName={supplier.name}
          mine={mine ? { rating: mine.rating, comment: mine.comment ?? "" } : null}
        />
        {others.length > 0 ? (
          <ul className="border-t border-ink">
            {others.map((r) => (
              <li key={r.userId} className="border-b border-hairline px-5 py-4 last:border-b-0 sm:px-8">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} size={14} />
                  <p className="text-sm">
                    <span className="font-semibold">{r.userName}</span>
                    <span className="text-ink-2"> · {formatDate(r.createdAt, now)}</span>
                  </p>
                </div>
                {r.comment ? <p className="mt-1.5 max-w-prose text-sm">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </article>
  );

  // An admin's label always sits in the editor, so restoring an archived supplier hands
  // focus to Edit once the label prints active again.
  if (!isAdmin) return label;
  return (
    <LabelEditor
      gone="Archived. It can be restored from its label."
      form={
        canEdit ? (
          <SupplierForm
            supplierId={supplier.id}
            defaults={{
              name: supplier.name,
              email: supplier.email ?? "",
              phone: supplier.phone ?? "",
              leadTimeDays: String(supplier.leadTimeDays),
            }}
            action={action}
            archive={{ supplierId: supplier.id, name: supplier.name, products: products.length }}
          />
        ) : null
      }
    >
      {label}
    </LabelEditor>
  );
}

/**
 * What the supplier needs now, in one sentence: an archived one takes no orders; one
 * with products running low gets the way to draft them, on yellow attention stock;
 * otherwise nothing needs ordering.
 */
function Status({
  supplier,
  suggestion,
  isAdmin,
}: {
  supplier: Supplier;
  suggestion: Awaited<ReturnType<typeof getReorderSuggestions>>["suppliers"][number] | undefined;
  isAdmin: boolean;
}) {
  if (supplier.archivedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink px-5 py-4 sm:px-8">
        <p className="min-w-0 flex-1 basis-72 text-sm text-ink-2">
          <strong className="font-bold text-ink">Archived.</strong> It takes no new orders, so its products can&apos;t
          be ordered until it&apos;s restored or they&apos;re given another supplier. Its orders stay as they were
          {isAdmin ? "" : ", and an admin can restore it"}.
        </p>
        {isAdmin ? <RestoreSupplier supplierId={supplier.id} /> : null}
      </div>
    );
  }

  if (suggestion && suggestion.toDraft > 0) {
    const names = suggestion.lines.filter((l) => l.draftId === null).map((l) => l.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink bg-stock px-5 py-4 sm:px-8">
        <p className="min-w-0 flex-1 basis-72 text-sm">
          <strong className="font-bold">Reorder.</strong> {list} {names.length === 1 ? "is" : "are"} running low. A
          draft puts the forecast&apos;s quantities on one order, {formatMoney(suggestion.totalCents)} at today&apos;s
          costs; nothing is sent until an admin places it.
        </p>
        <DraftButton supplierId={supplier.id} supplierName={supplier.name} />
      </div>
    );
  }

  if (suggestion) {
    const drafts = [...new Set(suggestion.lines.flatMap((l) => (l.draftId === null ? [] : [l.draftId])))];
    return (
      <p className="border-b-2 border-ink px-5 py-4 text-sm sm:px-8">
        <strong className="font-bold">Drafted.</strong> What&apos;s running low is on{" "}
        {drafts.map((draftId, i) => (
          <span key={draftId}>
            {i > 0 ? ", " : null}
            <Link
              href={`/orders/${draftId}`}
              prefetch={false}
              transitionTypes={NAV_FORWARD}
              className="font-semibold underline decoration-ink-3 underline-offset-4 hover:decoration-ink"
            >
              {poNumber(draftId)}
            </Link>
          </span>
        ))}
        , waiting to be placed.
      </p>
    );
  }

  return (
    <p className="border-b-2 border-ink px-5 py-4 text-sm sm:px-8">
      <strong className="font-bold">Stocked.</strong> Nothing from {supplier.name} needs ordering, counting what&apos;s
      already on order.
    </p>
  );
}

/** The same label, unprinted, in the shape of what will print. */
export function SupplierLabelPlaceholder({ action }: { action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-48 bg-liner/70" />
        </div>
        {action}
      </div>
      <TallyPlaceholder names={["Lead time", "Products", "On time", "Rating"]} className={FOUR_TALLIES} notes />
      <div className="border-b-2 border-ink px-5 py-4 sm:px-8">
        <div className="h-5 w-4/5 bg-liner/70" />
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-10 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
