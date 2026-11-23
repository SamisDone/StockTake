import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { getCustomer } from "@/domain/customers";
import { DomainError } from "@/domain/errors";
import { listSales, saleNumber } from "@/domain/sales";
import { EitherLanguage } from "@/components/either-language";
import { IntentLink } from "@/components/intent-link";
import { EditButton, LabelEditor } from "@/components/label-editor";
import { Tally, TallyPlaceholder } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { moneyFormat } from "@/lib/money";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { SALES_COPY } from "../sales/copy";
import { DueMark, VoidedMark } from "../sales/marks";
import { CUSTOMERS_COPY } from "./copy";
import { CustomerForm } from "./customer-form";
import { PaymentForm } from "./payment-form";

/** A customer ID from the URL, or a 404 for anything that isn't one. */
export function customerId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

/**
 * A customer printed as one label: how to reach them, what they've bought and paid and
 * still owe (on yellow stock while they owe), a way to take a payment, their sales and
 * their payments. Anyone can edit their details in place.
 */
export async function CustomerLabel({ id, action }: { id: number; action: ReactNode }) {
  await getCurrentUser();
  const language = await getLanguage();
  const t = CUSTOMERS_COPY[language];
  const st = SALES_COPY[language];
  const f = formats(language);
  const money = await getMoneyPrefs();
  const m = moneyFormat(money, language);
  await connection();
  const db = await getDb();
  const now = new Date();

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(db, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const sales = await listSales(db, { customerId: id });
  const due = customer.dueCents;
  const status = due > 0 ? t.status.due(m.money(due)) : due < 0 ? t.status.credit(m.money(-due)) : t.status.paidUp;

  const label = (
    <article aria-labelledby="customer-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="customer-title" className="print-display text-4xl text-balance sm:text-5xl">
            {customer.name}
          </h1>
          {customer.phone || customer.email ? (
            <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink-2">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
                  className="tabular underline decoration-ink-3/50 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
                >
                  {customer.phone}
                </a>
              ) : null}
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="underline decoration-ink-3/50 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
                >
                  {customer.email}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <EditButton language={language} />
          {action}
        </div>
      </header>

      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.labelTallies[0]} value={m.money(customer.boughtCents)} language={language} />
        <Tally name={t.labelTallies[1]} value={m.money(customer.paidCents)} language={language} />
        <Tally name={t.labelTallies[2]} value={m.money(Math.max(due, 0))} language={language} />
      </dl>

      <div
        id="customer-status"
        tabIndex={-1}
        aria-live="polite"
        className={`border-b-2 border-ink px-5 py-3 transition-colors duration-(--dur-collapse) ease-out outline-none sm:px-8 ${due > 0 ? "bg-stock" : ""}`}
      >
        <p className="max-w-prose text-sm">
          <strong className="font-bold">{status.lead}</strong> {status.text}
        </p>
      </div>

      {due > 0 ? (
        <PaymentForm
          key={due}
          customerId={customer.id}
          name={customer.name}
          dueCents={due}
          money={money}
          language={language}
        />
      ) : null}

      <section aria-labelledby="customer-sales" className="pt-5">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-8">
          <h2 id="customer-sales" className="text-lg font-bold">
            {t.sales}
          </h2>
          <IntentLink
            href={`/sales/new?customer=${customer.id}`}
            transitionTypes={NAV_FORWARD}
            className="-my-2 -mr-3 flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink"
          >
            <Plus aria-hidden size={18} strokeWidth={2.25} />
            {t.newSale}
          </IntentLink>
        </div>
        {sales.length === 0 ? (
          <p className="px-5 pt-2 pb-2 text-sm text-ink-2 sm:px-8">{t.noSales}</p>
        ) : (
          <ul className="mt-2">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-2.5 text-sm row-hit last:border-b-0 sm:px-8"
              >
                <span className="flex min-w-0 items-baseline gap-3">
                  <IntentLink
                    href={`/sales/${sale.id}`}
                    transitionTypes={NAV_FORWARD}
                    className="font-mono text-xs font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                  >
                    {sale.number}
                  </IntentLink>
                  <span className="text-ink-2">{f.date(sale.soldAt, now)}</span>
                  {sale.voided ? <VoidedMark label={st.voided} /> : null}
                </span>
                <span className="flex items-baseline gap-3">
                  {sale.dueCents > 0 ? <DueMark>{t.dueOnSale(m.money(sale.dueCents))}</DueMark> : null}
                  <span className={`tabular font-semibold ${sale.voided ? "text-ink-3 line-through" : ""}`}>
                    {m.money(sale.totalCents)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="customer-payments" className="border-t-2 border-ink pt-5 pb-8">
        <h2 id="customer-payments" className="px-5 text-lg font-bold sm:px-8">
          {t.payments}
        </h2>
        {customer.payments.length === 0 ? (
          <p className="px-5 pt-2 text-sm text-ink-2 sm:px-8">{t.noPayments}</p>
        ) : (
          <ol className="mt-2 px-5 text-sm sm:px-8">
            {customer.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap gap-x-4 border-b border-hairline py-2 last:border-b-0">
                <span className="w-24 shrink-0 text-ink-2 lang-bn:w-28">{f.date(payment.receivedAt, now)}</span>
                <span className="tabular font-semibold">{m.money(payment.amountCents)}</span>
                <span className="text-ink-2">
                  {st.methods[payment.method]}
                  {payment.saleId ? ` · ${t.atSale(saleNumber(payment.saleId))}` : ""}
                  {payment.userName ? ` · ${t.by(payment.userName)}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {customer.note ? (
          <div className="mt-4 px-5 sm:px-8">
            <p className="field-name">{t.note}</p>
            <p className="mt-0.5 max-w-prose text-sm">{customer.note}</p>
          </div>
        ) : null}
      </section>
    </article>
  );

  return (
    <LabelEditor
      gone={t.gone}
      form={
        <CustomerForm
          customerId={customer.id}
          language={language}
          defaults={{
            name: customer.name,
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            note: customer.note ?? "",
          }}
          action={action}
        />
      }
    >
      {label}
    </LabelEditor>
  );
}

/** The same label, unprinted, holding its shape while the customer loads. */
export function CustomerLabelPlaceholder({ action }: { action: (language: Language) => ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-40 bg-liner/70" />
        </div>
        <EitherLanguage>{action}</EitherLanguage>
      </div>
      <EitherLanguage>
        {(language) => <TallyPlaceholder names={CUSTOMERS_COPY[language].labelTallies} />}
      </EitherLanguage>
      <div className="border-b-2 border-ink px-5 py-3 sm:px-8">
        <div className="h-5 w-3/5 bg-liner/70" />
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
