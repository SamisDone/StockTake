import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getOrder, poNumber } from "@/domain/purchase-orders";
import { Mark } from "@/components/logo";
import { parseDayKey } from "@/lib/business-time";
import { formats } from "@/lib/format";
import { LANGUAGE_TAGS } from "@/lib/i18n";
import { moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { MARK_BASE, ORDER_MARK } from "../../../../(app)/orders/status";
import { ORDERS_COPY } from "../../../../(app)/orders/copy";
import { PRINT_COPY } from "../../../print-copy";
import { PrintButton } from "../../../print-button";

const ID = /^\d{1,9}$/;

/** The tab's title is what a saved PDF is named after: the order's number. */
export async function generateMetadata({ params }: PageProps<"/orders/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  return { title: ID.test(id) ? poNumber(Number(id)) : PRINT_COPY[await getLanguage()].document };
}

/**
 * A purchase order printed as a document to send the supplier: one A4 sheet with who
 * it's for, its dates, its lines and the total, and room to sign. Outside the app shell,
 * so the page prints as nothing but the order; the browser's print dialog saves it as a
 * PDF. Printed in the reader's language and currency.
 */
export default function PrintOrderPage({ params }: PageProps<"/orders/[id]/print">) {
  return (
    <main className="min-h-dvh px-3 py-3 sm:px-6 sm:py-6 print:p-0">
      <Suspense fallback={<div aria-hidden className="sheet mx-auto min-h-240 max-w-208" />}>
        <PrintedOrder params={params} />
      </Suspense>
    </main>
  );
}

async function PrintedOrder({ params }: { params: PageProps<"/orders/[id]/print">["params"] }) {
  await getCurrentUser();
  const { id: raw } = await params;
  if (!ID.test(raw)) notFound();
  const language = await getLanguage();
  const t = PRINT_COPY[language];
  const statusNames = ORDERS_COPY[language].status;
  const f = formats(language);
  const prefs = await getMoneyPrefs();
  const m = moneyFormat(prefs, language);
  await connection();
  const now = new Date();

  let order: Awaited<ReturnType<typeof getOrder>>;
  try {
    order = await getOrder(await getDb(), Number(raw));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }

  // A document is read later and elsewhere, so every date carries its year.
  const date = (when: Date | null) => (when ? f.date(when, new Date(0)) : "–");
  const tracking = order.status === "ordered" || order.status === "received";
  const rateDay = parseDayKey(prefs.rateAsOf);
  const when =
    order.status === "received"
      ? { name: t.receivedOn, date: order.receivedAt, basis: null }
      : order.status === "cancelled"
        ? { name: t.cancelledOn, date: order.cancelledAt, basis: null }
        : order.status === "ordered"
          ? { name: t.due, date: order.dueAt, basis: order.expectedAt ? null : t.dueBasis(f.days(order.leadTimeDays)) }
          : { name: t.expected, date: order.expectedAt, basis: null };
  const rate = new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div lang={LANGUAGE_TAGS[language]} className="mx-auto max-w-208">
      {/* What to do with the page; none of it prints. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner-deep hover:text-ink"
        >
          <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="max-w-xs text-sm text-ink-2 max-sm:order-last">{t.printHelp}</p>
          <PrintButton label={t.print} />
        </div>
      </div>

      <article
        aria-labelledby="po-title"
        className="sheet overflow-hidden print:overflow-visible print:rounded-none print:shadow-none"
      >
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink px-6 pt-7 pb-5 sm:px-10">
          <div className="min-w-0">
            <h1 id="po-title" className="print-display text-4xl sm:text-5xl">
              {t.document}
            </h1>
            <p className="mt-2 font-mono text-lg font-semibold">{order.number}</p>
          </div>
          <p lang="en" className="print-display flex shrink-0 items-center gap-2 text-xl uppercase sm:text-2xl">
            <Mark size={32} />
            Stocktake
          </p>
        </header>

        {order.status === "draft" || order.status === "cancelled" ? (
          <p className="flex items-baseline gap-2 border-b-2 border-ink px-6 py-3 text-sm sm:px-10">
            <span className={`${MARK_BASE} ${ORDER_MARK[order.status]} shrink-0`}>{statusNames[order.status]}</span>
            <span>{order.status === "draft" ? t.notPlaced : t.cancelledNote}</span>
          </p>
        ) : null}

        {/* The order's facts as boxed fields: the supplier takes the left half. */}
        <dl className="grid grid-cols-2 border-b-2 border-ink sm:grid-cols-4">
          <Field name={t.to} className="col-span-2 border-b border-ink sm:row-span-2 sm:border-r sm:border-b-0">
            <span className="block text-lg font-bold">{order.supplierName}</span>
            {order.supplierEmail ? <span className="block text-sm">{order.supplierEmail}</span> : null}
            {order.supplierPhone ? <span className="tabular block text-sm">{order.supplierPhone}</span> : null}
          </Field>
          <Field name={t.status} className="border-r border-b border-ink">
            <span className={`${MARK_BASE} ${ORDER_MARK[order.status]} print:[print-color-adjust:exact]`}>
              {statusNames[order.status]}
            </span>
          </Field>
          <Field name={t.placed} className="border-b border-ink">
            {date(order.orderedAt)}
          </Field>
          {/* Where the order stands in time: when it's due, or when it came or was called off. */}
          <Field name={when.name} className="border-r border-ink">
            {date(when.date)}
            {when.basis ? <span className="block text-xs text-ink-3">{when.basis}</span> : null}
          </Field>
          <Field name={t.drafted}>
            {order.createdByName}
            <span className="block text-xs text-ink-3">{date(order.createdAt)}</span>
          </Field>
        </dl>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <Th className="w-10 pl-6 sm:pl-10">{t.number}</Th>
              <Th className="w-full">{t.product}</Th>
              <Th align="right">{t.quantity}</Th>
              {tracking ? <Th align="right">{t.received}</Th> : null}
              <Th align="right">{t.unitCost}</Th>
              <Th align="right" className="pr-6 sm:pr-10">
                {t.lineTotal}
              </Th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, i) => (
              <tr key={line.id} className="border-b border-hairline align-top break-inside-avoid last:border-b-0">
                <td className="tabular py-2.5 pr-3 pl-6 text-ink-2 sm:pl-10">{f.count(i + 1)}</td>
                <td className="py-2.5 pr-4">
                  <span className="block font-semibold">{line.name}</span>
                  <span className="block font-mono text-xs text-ink-3">{line.sku}</span>
                </td>
                <td className="tabular py-2.5 pr-4 text-right">{f.count(line.quantity)}</td>
                {tracking ? <td className="tabular py-2.5 pr-4 text-right">{f.count(line.received)}</td> : null}
                <td className="tabular py-2.5 pr-4 text-right whitespace-nowrap">{m.money(line.unitCostCents)}</td>
                <td className="tabular py-2.5 pr-6 text-right font-semibold whitespace-nowrap sm:pr-10">
                  {m.money(line.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* The figure the order commits to, reverse-printed, on paper too. */}
        <div className="flex items-baseline justify-between gap-4 bg-ink px-6 py-3 text-label break-inside-avoid sm:px-10 print:[print-color-adjust:exact]">
          <p className="font-semibold">{t.total}</p>
          <p className="print-display text-3xl sm:text-4xl">{m.money(order.totalCents)}</p>
        </div>

        {order.notes ? (
          <div className="border-b-2 border-ink px-6 py-4 break-inside-avoid sm:px-10">
            <p className="field-name">{t.notes}</p>
            <p className="mt-1 max-w-prose text-sm whitespace-pre-line">{order.notes}</p>
          </div>
        ) : null}

        {/* Room to sign: two fields with a rule to write on. */}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] break-inside-avoid">
          <div className="border-r border-ink px-6 pt-3 pb-5 sm:px-10">
            <p className="field-name">{t.authorised}</p>
            <div className="mt-12 border-b border-ink" />
          </div>
          <div className="px-6 pt-3 pb-5 sm:px-10">
            <p className="field-name">{t.date}</p>
            <div className="mt-12 border-b border-ink" />
          </div>
        </div>

        <p className="border-t border-hairline px-6 py-3 text-xs text-ink-3 sm:px-10">
          {t.printedAt(`${date(now)}, ${f.time(now)}`)}{" "}
          {m.currency === "BDT"
            ? `${t.currency.BDT}${t.rate(rate.format(prefs.bdtPerUsd), rateDay ? date(rateDay) : prefs.rateAsOf)}`
            : t.currency.USD}
        </p>
      </article>
    </div>
  );
}

function Field({ name, className = "", children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <div className={`px-6 pt-2.5 pb-3 sm:px-5 sm:first:px-10 ${className}`}>
      <dt className="field-name">{name}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Th({
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
      className={`field-name pt-3 pr-4 pb-2 whitespace-nowrap ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}
