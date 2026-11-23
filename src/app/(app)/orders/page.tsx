import { ChevronDown, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { isLate, listOrders, poNumber } from "@/domain/purchase-orders";
import { type SupplierSuggestion, type SuggestedLine, getReorderSuggestions } from "@/domain/reorder";
import { PageHeader } from "@/components/page-header";
import { MobileName, Tally, TallyPlaceholder, Th } from "@/components/stock";
import { NAV_FORWARD, PageTransition, Reveal } from "@/components/transitions";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyFormat, moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { ORDERS_COPY, type OrdersCopy } from "./copy";
import { DraftButton } from "./draft-button";
import { type OrderRow, OrderTable } from "./order-table";
import { orderWhen } from "./status";
import { IntentLink } from "@/components/intent-link";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";
import { both } from "@/lib/i18n";
import { ProductLink } from "@/components/product-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: ORDERS_COPY[await getLanguage()].title };
}

export default function OrdersPage() {
  return (
    <PageTransition>
      <PageHeader
        title={both(ORDERS_COPY, (t) => t.title)}
        actions={
          // Anyone can draft an order, so this needs no session and prints with the page.
          <Link
            href="/orders/new"
            transitionTypes={NAV_FORWARD}
            className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-active:scale-[0.96]">
              <Plus aria-hidden size={18} strokeWidth={2.5} />
              <EitherLanguage inline>{(language) => ORDERS_COPY[language].newOrder}</EitherLanguage>
            </span>
          </Link>
        }
      />
      <Reveal
        fallback={<EitherLanguage>{(language) => <OrdersPlaceholder t={ORDERS_COPY[language]} />}</EitherLanguage>}
      >
        <WithLanguage>{(language) => <Orders language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function Orders({ language }: { language: Language }) {
  const t = ORDERS_COPY[language];
  const f = formats(language);
  await getCurrentUser();
  // Lateness and suggestions are relative to now, so they belong to the request.
  await connection();
  const db = await getDb();
  const now = new Date();
  const money = await getMoneyPrefs();
  const m = moneyFormat(money, language);
  const [orders, suggestions] = await Promise.all([listOrders(db), getReorderSuggestions(db, now)]);

  // Only what the table prints crosses to the browser.
  const rows: OrderRow[] = orders.map((o) => {
    const late = isLate(o, now);
    const when = orderWhen(o, now, language);
    return {
      id: o.id,
      number: o.number,
      supplierName: o.supplierName,
      status: o.status,
      lineCount: o.lineCount,
      totalCents: o.totalCents,
      when,
      sortAt:
        (o.status === "draft"
          ? o.createdAt
          : o.status === "ordered"
            ? o.dueAt
            : o.status === "received"
              ? o.receivedAt
              : o.cancelledAt
        )?.getTime() ?? null,
      late,
    };
  });
  const placed = orders.filter((o) => o.status === "ordered");

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={orders.filter((o) => o.status === "draft").length} language={language} />
        <Tally
          name={t.tallies[1]}
          value={m.whole(placed.reduce((sum, o) => sum + o.totalCents, 0))}
          language={language}
        />
        <Tally name={t.tallies[2]} value={rows.filter((r) => r.late).length} language={language} />
      </dl>
      <Suggestions suppliers={suggestions.suppliers} unsupplied={suggestions.unsupplied} m={m} f={f} t={t} />
      <OrderTable rows={rows} money={money} language={language} />
    </>
  );
}

/**
 * What the forecast says to order, one row per supplier. Drafting makes an order a
 * person can still change; nothing is sent until an admin places it.
 */
function Suggestions({
  suppliers,
  unsupplied,
  m,
  f,
  t,
}: {
  suppliers: SupplierSuggestion[];
  unsupplied: SuggestedLine[];
  m: MoneyFormat;
  f: Formats;
  t: OrdersCopy;
}) {
  // Nothing to suggest: one line, nothing to open.
  if (suppliers.length === 0 && unsupplied.length === 0)
    return (
      <section aria-labelledby="suggested-title" className="border-b-2 border-ink px-5 py-4 sm:px-8">
        <h2 id="suggested-title" className="inline text-lg font-bold">
          {t.suggested}
        </h2>
        <span className="text-ink-2"> · {t.nothingToReorder}</span>
      </section>
    );
  const cost = suppliers.reduce((sum, s) => sum + s.totalCents, 0);
  // Folded to one line, so the orders themselves are on the first screen.
  return (
    <details className="fold group border-b-2 border-ink">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 row-hit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:px-8 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h2 id="suggested-title" className="inline text-lg font-bold">
            {t.suggested}
          </h2>
          <span className="text-ink-2">
            {" "}
            · {t.suggestedSummary(suppliers.length, f.count(suppliers.length), m.money(cost))}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          size={20}
          strokeWidth={2.25}
          className="shrink-0 text-ink-2 transition-transform duration-150 ease-out group-open:rotate-180"
        />
      </summary>
      <div className="pb-6">
        <p className="max-w-prose px-5 text-sm text-ink-2 sm:px-8">{t.suggestedHelp}</p>

        {suppliers.length === 0 ? (
          <p className="mt-4 px-5 font-semibold sm:px-8">{t.nothingToReorder}</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left max-md:block">
            <thead className="max-md:hidden">
              <tr className="border-b border-ink">
                <Th>{t.supplier}</Th>
                <Th className="w-full">{t.products}</Th>
                <Th align="right">{t.cost}</Th>
                <Th>
                  <span className="sr-only">{t.action}</span>
                </Th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {suppliers.map((s) => (
                <SuggestionRow key={s.supplierId} suggestion={s} m={m} f={f} t={t} />
              ))}
            </tbody>
          </table>
        )}

        {unsupplied.length > 0 ? (
          <p className="mt-4 max-w-prose px-5 text-sm text-ink-2 sm:px-8">
            {t.unsupplied[0]}
            {unsupplied.map((line, i) => (
              <span key={line.productId}>
                {i > 0 ? ", " : null}
                <ProductLink
                  id={line.productId}
                  className="font-semibold text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                >
                  {line.name}
                </ProductLink>
              </span>
            ))}
            {t.unsupplied[1]}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function SuggestionRow({
  suggestion: s,
  m,
  f,
  t,
}: {
  suggestion: SupplierSuggestion;
  m: MoneyFormat;
  f: Formats;
  t: OrdersCopy;
}) {
  const drafts = [...new Set(s.lines.flatMap((line) => (line.draftId === null ? [] : [line.draftId])))];
  return (
    <tr className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-2 max-md:gap-x-5 max-md:gap-y-3 max-md:px-5 max-md:py-4 sm:max-md:px-8">
      <td className="py-3 pr-4 whitespace-nowrap max-md:col-span-2 max-md:p-0 md:pl-8">
        <p className="font-semibold">{s.supplierName}</p>
        <p className="text-sm text-ink-3">{t.leadTime(f.count(s.leadTimeDays))}</p>
      </td>
      <td className="py-3 pr-4 max-md:col-span-2 max-md:p-0">
        <MobileName>{t.products}</MobileName>
        <ul className="text-sm">
          {s.lines.map((line) => (
            <li key={line.productId} className={line.draftId === null ? "" : "text-ink-3"}>
              {line.name} × {f.count(line.quantity)}
              {line.draftId !== null ? t.onDraft(poNumber(line.draftId)) : null}
            </li>
          ))}
        </ul>
      </td>
      <td className="tabular py-3 pr-4 text-right whitespace-nowrap max-md:p-0 max-md:text-left">
        <MobileName>{t.cost}</MobileName>
        {s.toDraft > 0 ? (
          <span className="font-semibold">{m.money(s.totalCents)}</span>
        ) : (
          <span className="text-ink-2">–</span>
        )}
      </td>
      <td className="py-2 whitespace-nowrap max-md:p-0 md:pr-8">
        {s.toDraft > 0 ? (
          <DraftButton supplierId={s.supplierId} supplierName={s.supplierName} language={f.language} />
        ) : (
          <span className="text-sm text-ink-2">
            {t.on}{" "}
            {drafts.map((id, i) => (
              <span key={id}>
                {i > 0 ? ", " : null}
                <IntentLink
                  href={`/orders/${id}`}
                  transitionTypes={NAV_FORWARD}
                  className="font-semibold text-ink underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                >
                  {poNumber(id)}
                </IntentLink>
              </span>
            ))}
          </span>
        )}
      </td>
    </tr>
  );
}

/** The same label, unprinted: tallies, the suggestions and the rows hold their space. */
function OrdersPlaceholder({ t }: { t: OrdersCopy }) {
  return (
    <div aria-hidden>
      <TallyPlaceholder names={t.tallies} />
      <div className="flex min-h-14 items-center border-b-2 border-ink px-5 py-4 sm:px-8">
        <p className="text-lg font-bold">{t.suggested}</p>
      </div>
      <div className="space-y-5 px-5 pt-6 sm:px-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
