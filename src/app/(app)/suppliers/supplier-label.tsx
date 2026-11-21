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
import { CoverBar, FOUR_TALLIES, MobileName, StatusMark, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyFormat, moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { DraftButton } from "../orders/draft-button";
import { orderWhen } from "../orders/status";
import { SUPPLIERS_COPY, type SuppliersCopy } from "./copy";
import { RestoreSupplier } from "./restore-supplier";
import { ReviewForm } from "./review-form";
import { SupplierForm } from "./supplier-form";
import { IntentLink } from "@/components/intent-link";

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
  const [forecasts, orders, money] = await Promise.all([
    getStockForecasts(db, now),
    listOrders(db, { supplierId: id }),
    getMoneyPrefs(),
  ]);
  const language = await getLanguage();
  const t = SUPPLIERS_COPY[language];
  const f = formats(language);
  const m = moneyFormat(money, language);
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
                  {t.archivedOn(f.date(supplier.archivedAt, now))}
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
            {!supplier.email && !supplier.phone && !supplier.archivedAt ? t.noContact : null}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {canEdit ? <EditButton language={language} /> : null}
          {action}
        </div>
      </header>
      <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
        <Tally
          name={t.labelTallies[0]}
          language={language}
          value={t.days(supplier.leadTimeDays, f.count(supplier.leadTimeDays))}
        />
        <Tally name={t.labelTallies[1]} value={products.length} language={language}>
          <p className="mt-1 text-sm text-ink-2">{low > 0 ? t.runningLow(f.count(low)) : t.noneLow}</p>
        </Tally>
        <Tally
          name={t.labelTallies[2]}
          language={language}
          value={record.received === 0 ? "–" : `${f.count(Math.round((record.onTime / record.received) * 100))}%`}
        >
          <p className="mt-1 text-sm text-ink-2">
            {record.received === 0 ? t.nothingReceived : t.byDueDay(f.count(record.onTime), f.count(record.received))}
          </p>
        </Tally>
        <Tally
          name={t.labelTallies[3]}
          language={language}
          value={supplier.averageRating === null ? "–" : formatRating(supplier.averageRating, language)}
        >
          {supplier.averageRating === null ? (
            <p className="mt-1 text-sm text-ink-2">{t.noReviews}</p>
          ) : (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
              <Stars rating={supplier.averageRating} size={14} language={language} />
              {t.reviewCount(supplier.reviewCount, f.count(supplier.reviewCount))}
            </p>
          )}
        </Tally>
      </dl>

      <Status supplier={supplier} suggestion={suggestion} isAdmin={isAdmin} m={m} t={t} language={language} />

      <section aria-labelledby="products-title" className="border-b-2 border-ink pt-5 pb-6">
        <div className="px-5 sm:px-8">
          <h2 id="products-title" className="text-lg font-bold">
            {t.products}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            {t.productsHelp(supplier.name, f.count(supplier.leadTimeDays))}
          </p>
        </div>
        {products.length === 0 ? (
          <p className="mt-4 px-5 font-semibold sm:px-8">{t.noProducts(supplier.name)}</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-left max-md:block">
            <caption className="sr-only">{t.productsCaption(f.count(products.length))}</caption>
            <thead className="max-md:hidden">
              <tr className="border-b border-ink">
                <Th className="w-full">{t.product}</Th>
                <Th align="right" className="whitespace-nowrap">
                  {t.onHand}
                </Th>
                <Th className="min-w-56">{t.cover}</Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="relative border-b border-hairline align-top row-hit last:border-b-0 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-6 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8"
                >
                  <td className="py-3 pr-4 max-md:col-span-2 max-md:p-0 md:pl-8">
                    <div className="flex items-baseline gap-2">
                      <StatusMark status={p.status} language={language} />
                      <IntentLink
                        href={`/products/${p.id}`}
                        className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                      >
                        {p.name}
                      </IntentLink>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-ink-3">{p.sku}</p>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap max-md:p-0 md:text-right">
                    <MobileName>{t.onHand}</MobileName>
                    <span className="tabular">{f.count(p.onHand)}</span>
                  </td>
                  <td className="py-3 max-md:p-0 md:pr-8">
                    <MobileName>{t.cover}</MobileName>
                    <CoverBar daysOfCover={p.daysOfCover} leadTimeDays={p.leadTimeDays} language={language} />
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
              {t.orders}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {orders.length === 0
                ? t.noOrders(supplier.name)
                : orders.length > ORDER_LIMIT
                  ? t.latestOrders(f.count(ORDER_LIMIT), f.count(orders.length))
                  : t.newestFirst}
            </p>
          </div>
          {supplier.archivedAt ? null : (
            <Link
              href={`/orders/new?supplier=${supplier.id}`}
              transitionTypes={NAV_FORWARD}
              className="press-quiet -mr-3 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner"
            >
              <Plus aria-hidden size={18} strokeWidth={2.25} />
              {t.newOrder}
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
                  className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-3 transition-colors duration-150 last:border-b-0 row-hit sm:px-8"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    {late ? (
                      <span className="shrink-0 rounded-mark bg-stock px-1.5 py-px text-xs font-bold">{t.late}</span>
                    ) : null}
                    <IntentLink
                      href={`/orders/${o.id}`}
                      transitionTypes={NAV_FORWARD}
                      className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                    >
                      {o.number}
                    </IntentLink>
                    <span className="text-sm text-ink-2">
                      {/* The date phrase names the state ("Received Nov 19"); only "Due" needs "Placed". */}
                      {o.status === "ordered" ? `${t.placed} · ` : null}
                      {orderWhen(o, now, language)}
                    </span>
                  </div>
                  <span className="tabular font-semibold">{m.money(o.totalCents)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="reviews-title" className="pt-5 pb-8">
        <div className="px-5 sm:px-8">
          <h2 id="reviews-title" className="text-lg font-bold">
            {t.reviews}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{t.reviewsHelp}</p>
        </div>
        <ReviewForm
          supplierId={supplier.id}
          supplierName={supplier.name}
          language={language}
          mine={mine ? { rating: mine.rating, comment: mine.comment ?? "" } : null}
        />
        {others.length > 0 ? (
          <ul className="border-t border-ink">
            {others.map((r) => (
              <li key={r.userId} className="border-b border-hairline px-5 py-4 last:border-b-0 sm:px-8">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} size={14} language={language} />
                  <p className="text-sm">
                    <span className="font-semibold">{r.userName}</span>
                    <span className="text-ink-2"> · {f.date(r.createdAt, now)}</span>
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
      gone={t.gone}
      form={
        canEdit ? (
          <SupplierForm
            supplierId={supplier.id}
            language={language}
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
  m,
  t,
  language,
}: {
  supplier: Supplier;
  suggestion: Awaited<ReturnType<typeof getReorderSuggestions>>["suppliers"][number] | undefined;
  isAdmin: boolean;
  m: MoneyFormat;
  t: SuppliersCopy;
  language: Language;
}) {
  const s = t.status;
  if (supplier.archivedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink px-5 py-4 sm:px-8">
        <p className="min-w-0 flex-1 basis-72 text-sm text-ink-2">
          <strong className="font-bold text-ink">{s.archived(isAdmin).lead}</strong> {s.archived(isAdmin).text}
        </p>
        {isAdmin ? <RestoreSupplier supplierId={supplier.id} language={language} /> : null}
      </div>
    );
  }

  if (suggestion && suggestion.toDraft > 0) {
    const names = suggestion.lines.filter((l) => l.draftId === null).map((l) => l.name);
    const reorder = s.reorder(names, m.money(suggestion.totalCents));
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink bg-stock px-5 py-4 sm:px-8">
        <p className="min-w-0 flex-1 basis-72 text-sm">
          <strong className="font-bold">{reorder.lead}</strong> {reorder.text}
        </p>
        <DraftButton supplierId={supplier.id} supplierName={supplier.name} language={language} />
      </div>
    );
  }

  if (suggestion) {
    const drafts = [...new Set(suggestion.lines.flatMap((l) => (l.draftId === null ? [] : [l.draftId])))];
    return (
      <p className="border-b-2 border-ink px-5 py-4 text-sm sm:px-8">
        <strong className="font-bold">{s.drafted.lead}</strong> {s.drafted.before}
        {drafts.map((draftId, i) => (
          <span key={draftId}>
            {i > 0 ? ", " : null}
            <Link
              href={`/orders/${draftId}`}
              transitionTypes={NAV_FORWARD}
              className="font-semibold underline decoration-ink-3 underline-offset-4 hover:decoration-ink"
            >
              {poNumber(draftId)}
            </Link>
          </span>
        ))}
        {s.drafted.after}
      </p>
    );
  }

  return (
    <p className="border-b-2 border-ink px-5 py-4 text-sm sm:px-8">
      <strong className="font-bold">{s.stocked(supplier.name).lead}</strong> {s.stocked(supplier.name).text}
    </p>
  );
}

/** The same label, unprinted, in the shape of what will print. */
export function SupplierLabelPlaceholder({ language, action }: { language: Language; action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-48 bg-liner/70" />
        </div>
        {action}
      </div>
      <TallyPlaceholder names={SUPPLIERS_COPY[language].labelTallies} className={FOUR_TALLIES} notes />
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
