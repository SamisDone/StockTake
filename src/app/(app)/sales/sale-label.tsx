import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getSale } from "@/domain/sales";
import { ProductLink } from "@/components/product-link";
import { Tally, TallyPlaceholder } from "@/components/stock";
import { EitherLanguage } from "@/components/either-language";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { SALES_COPY } from "./copy";
import { VoidedMark } from "./marks";
import { VoidSale } from "./void-sale";

/** A sale ID from the URL, or a 404 for anything that isn't one. */
export function saleId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

/**
 * A sale printed as one label: who bought, whether anything is still owed and why, its
 * lines with what each went for, the discount and the total, and its history. An admin
 * can void it from the foot.
 */
export async function SaleLabel({ id, action }: { id: number; action: ReactNode }) {
  const user = await getCurrentUser();
  const language = await getLanguage();
  const t = SALES_COPY[language];
  const f = formats(language);
  const m = moneyFormat(await getMoneyPrefs(), language);
  await connection();
  const now = new Date();

  let sale: Awaited<ReturnType<typeof getSale>>;
  try {
    sale = await getSale(await getDb(), id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const voided = sale.voidedAt !== null;
  const units = sale.lines.reduce((sum, line) => sum + line.quantity, 0);
  const status = voided
    ? t.status.voided
    : sale.dueCents > 0
      ? t.status.due(m.money(sale.dueCents), sale.customerName ?? "")
      : t.status.paid;

  return (
    <article aria-labelledby="sale-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="sale-title" className="print-display text-4xl text-balance sm:text-5xl">
            {sale.customerId ? (
              <Link
                href={`/customers/${sale.customerId}`}
                className="underline decoration-ink-3/40 decoration-2 underline-offset-[0.12em] transition-colors duration-150 hover:decoration-ink"
              >
                {sale.customerName}
              </Link>
            ) : (
              t.walkIn
            )}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            <span className="font-mono text-xs">{sale.number}</span>
            <span>· {f.date(sale.soldAt, now)}</span>
            {voided ? <VoidedMark label={t.voided} /> : null}
          </p>
        </div>
        {action}
      </header>

      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.labelTallies[0]} value={sale.lines.length} language={language} />
        <Tally name={t.labelTallies[1]} value={units} language={language} />
        <Tally name={t.labelTallies[2]} value={m.money(sale.totalCents)} language={language} />
      </dl>

      {/* Why the sale stands where it does. Money still owed is printed on yellow stock. */}
      <div
        id="sale-status"
        tabIndex={-1}
        aria-live="polite"
        className={`border-b-2 border-ink px-5 py-3 outline-none sm:px-8 ${!voided && sale.dueCents > 0 ? "bg-stock" : ""}`}
      >
        <p className="max-w-prose text-sm">
          <strong className="font-bold">{status.lead}</strong> {status.text}
        </p>
      </div>

      <section aria-labelledby="sale-lines" className="pt-5">
        <h2 id="sale-lines" className="px-5 text-lg font-bold sm:px-8">
          {t.linesTitle}
        </h2>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <LineTh className="w-full pl-5 sm:pl-8">{t.form.product}</LineTh>
              <LineTh align="right">{t.form.quantity}</LineTh>
              <LineTh align="right" className="max-sm:hidden">
                {t.form.price}
              </LineTh>
              <LineTh align="right" className="max-sm:hidden">
                {t.form.discount}
              </LineTh>
              <LineTh align="right" className="pr-5 sm:pr-8">
                {t.form.lineTotal}
              </LineTh>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.id} className="border-b border-hairline align-top last:border-b-0">
                <td className="py-2.5 pr-4 pl-5 sm:pl-8">
                  <ProductLink
                    id={line.productId}
                    className="font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                  >
                    {line.name}
                  </ProductLink>
                  <p className="font-mono text-xs text-ink-3">{line.sku}</p>
                  {/* On a phone the price and discount columns fold under the name. */}
                  <p className="tabular text-xs text-ink-2 sm:hidden">
                    {f.count(line.quantity)} × {m.money(line.unitPriceCents)}
                    {line.discountCents > 0 ? ` − ${m.money(line.discountCents)}` : ""}
                  </p>
                </td>
                <td className="tabular py-2.5 pr-4 text-right">{f.count(line.quantity)}</td>
                <td className="tabular py-2.5 pr-4 text-right text-ink-2 max-sm:hidden">
                  {m.money(line.unitPriceCents)}
                </td>
                <td className="tabular py-2.5 pr-4 text-right text-ink-2 max-sm:hidden">
                  {line.discountCents > 0 ? `−${m.money(line.discountCents)}` : "–"}
                </td>
                <td className="tabular py-2.5 pr-5 text-right font-semibold sm:pr-8">
                  {m.money(line.quantity * line.unitPriceCents - line.discountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sale.discountCents > 0 ? (
          <dl className="mt-1 border-t border-ink px-5 py-2 text-sm sm:px-8">
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-ink-2">{t.subtotal}</dt>
              <dd className="tabular">{m.money(sale.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-ink-2">{t.saleDiscount}</dt>
              <dd className="tabular">−{m.money(sale.discountCents)}</dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-3 flex items-baseline justify-between gap-4 bg-ink px-5 py-3 text-label sm:px-8">
          <p className="font-semibold">{t.total}</p>
          <p className={`print-display text-[1.75rem] sm:text-5xl ${voided ? "line-through decoration-2" : ""}`}>
            {m.money(sale.totalCents)}
          </p>
        </div>
      </section>

      <section aria-labelledby="sale-history" className="pt-5 pb-8">
        <h2 id="sale-history" className="px-5 text-lg font-bold sm:px-8">
          {t.history}
        </h2>
        <ol className="mt-2 px-5 text-sm sm:px-8">
          <HistoryLine when={`${f.date(sale.soldAt, now)}, ${f.time(sale.soldAt)}`}>
            {t.soldBy(sale.createdByName)}
          </HistoryLine>
          {sale.payments.map((payment, i) => (
            <HistoryLine key={i} when={`${f.date(payment.receivedAt, now)}, ${f.time(payment.receivedAt)}`}>
              {t.paidAt(m.money(payment.amountCents), t.methods[payment.method])}
            </HistoryLine>
          ))}
          {sale.voidedAt ? (
            <HistoryLine when={`${f.date(sale.voidedAt, now)}, ${f.time(sale.voidedAt)}`}>{t.voidedLine}</HistoryLine>
          ) : null}
        </ol>
        {sale.note ? (
          <div className="mt-3 px-5 sm:px-8">
            <p className="field-name">{t.note}</p>
            <p className="mt-0.5 max-w-prose text-sm">{sale.note}</p>
          </div>
        ) : null}
      </section>

      {!voided && user.role === "admin" ? <VoidSale saleId={sale.id} number={sale.number} language={language} /> : null}
    </article>
  );
}

function HistoryLine({ when, children }: { when: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="tabular w-32 shrink-0 text-ink-2 lang-bn:w-40">{when}</span>
      <span>{children}</span>
    </li>
  );
}

function LineTh({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`field-name pt-1 pr-4 pb-2 whitespace-nowrap ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

/** The same label, unprinted, holding its shape while the sale loads. */
export function SaleLabelPlaceholder({ action }: { action: (language: Language) => ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-32 bg-liner/70" />
        </div>
        <EitherLanguage>{action}</EitherLanguage>
      </div>
      <EitherLanguage>{(language) => <TallyPlaceholder names={SALES_COPY[language].labelTallies} />}</EitherLanguage>
      <div className="border-b-2 border-ink px-5 py-3 sm:px-8">
        <div className="h-5 w-4/5 bg-liner/70" />
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
