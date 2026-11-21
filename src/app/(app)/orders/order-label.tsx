import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { getOrder } from "@/domain/purchase-orders";
import { getOrderableProducts } from "@/domain/reorder";
import { EditButton, LabelEditor } from "@/components/label-editor";
import { Tally, TallyPlaceholder } from "@/components/stock";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { moneyFormat } from "@/lib/money";
import { centsToInput } from "@/lib/parse";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { DraftForm } from "./draft-form";
import { dayInput } from "./draft-values";
import { OrderControls } from "./order-controls";
import { ORDERS_COPY, type OrdersCopy } from "./copy";
import { IntentLink } from "@/components/intent-link";

/** An order ID from the URL, or a 404 for anything that isn't one. */
export function orderId(raw: string) {
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) notFound();
  return id;
}

type Order = Awaited<ReturnType<typeof getOrder>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A purchase order printed as one label: who it's for, what state it's in and why,
 * what can be done with it next, its lines with the total, and its history. While it's
 * a draft, anyone can edit its lines in place; once placed, they're fixed.
 */
export async function OrderLabel({ id, action }: { id: number; action: ReactNode }) {
  const user = await getCurrentUser();
  const language = await getLanguage();
  const t = ORDERS_COPY[language];
  const f = formats(language);
  const m = moneyFormat(await getMoneyPrefs(), language);
  await connection();
  const db = await getDb();
  const now = new Date();

  let order: Order;
  try {
    order = await getOrder(db, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const units = order.lines.reduce((total, line) => total + line.quantity, 0);
  const late = order.dueAt !== null && order.dueAt < now;
  const draft = order.status === "draft";

  const label = (
    <article aria-labelledby="order-title">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="order-title" className="print-display text-4xl text-balance sm:text-5xl">
            {order.supplierName}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            <span className="font-mono text-xs">{order.number}</span> · {t.status[order.status]}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {draft ? <EditButton language={language} /> : null}
          {action}
        </div>
      </header>

      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.labelTallies[0]} value={order.lines.length} language={language} />
        <Tally name={t.labelTallies[1]} value={units} language={language} />
        <Tally name={t.labelTallies[2]} value={m.money(order.totalCents)} language={language} />
      </dl>

      <Status order={order} late={late} now={now} f={f} t={t} />

      <OrderControls
        orderId={order.id}
        number={order.number}
        status={order.status}
        isAdmin={user.role === "admin"}
        language={language}
        receipts={order.lines.map((line) => `+${f.count(line.quantity)} ${line.name}`).join(", ")}
      />

      <section aria-labelledby="lines-title" className="pt-5">
        <h2 id="lines-title" className="px-5 text-lg font-bold sm:px-8">
          {t.linesTitle}
        </h2>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <LineTh className="w-full pl-5 sm:pl-8">{t.lineColumns.product}</LineTh>
              <LineTh align="right">{t.lineColumns.quantity}</LineTh>
              <LineTh align="right" className="max-sm:hidden">
                {t.lineColumns.unitCost}
              </LineTh>
              <LineTh align="right" className="pr-5 sm:pr-8">
                {t.lineColumns.lineTotal}
              </LineTh>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-hairline align-top last:border-b-0">
                <td className="py-2.5 pr-4 pl-5 sm:pl-8">
                  <IntentLink
                    href={`/products/${line.productId}`}
                    className="font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                  >
                    {line.name}
                  </IntentLink>
                  <p className="font-mono text-xs text-ink-3">{line.sku}</p>
                </td>
                <td className="tabular py-2.5 pr-4 text-right">{f.count(line.quantity)}</td>
                <td className="tabular py-2.5 pr-4 text-right text-ink-2 max-sm:hidden">
                  {m.money(line.unitCostCents)}
                </td>
                <td className="tabular py-2.5 pr-5 text-right font-semibold sm:pr-8">{m.money(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* The total, reverse-printed: the figure the order commits to. */}
        <div className="mt-3 flex items-baseline justify-between gap-4 bg-ink px-5 py-3 text-label sm:px-8">
          <p className="font-semibold">{t.total}</p>
          <p className="print-display text-[1.75rem] sm:text-5xl">{m.money(order.totalCents)}</p>
        </div>
      </section>

      <section aria-labelledby="history-title" className="pt-5 pb-8">
        <h2 id="history-title" className="px-5 text-lg font-bold sm:px-8">
          {t.history}
        </h2>
        <ol className="mt-2 px-5 text-sm sm:px-8">
          <HistoryLine date={order.createdAt} now={now} f={f}>
            {t.draftedBy(order.createdByName)}
          </HistoryLine>
          {order.orderedAt ? (
            <HistoryLine date={order.orderedAt} now={now} f={f}>
              {t.placedWith(order.supplierName)}
            </HistoryLine>
          ) : null}
          {order.receivedAt ? (
            <HistoryLine date={order.receivedAt} now={now} f={f}>
              {t.receivedLine(order.lines.length, f.count(order.lines.length))}
            </HistoryLine>
          ) : null}
          {order.cancelledAt ? (
            <HistoryLine date={order.cancelledAt} now={now} f={f}>
              {t.cancelledLine}
            </HistoryLine>
          ) : null}
        </ol>
        {order.notes ? (
          <div className="mt-3 px-5 sm:px-8">
            <p className="field-name">{t.notes}</p>
            <p className="mt-0.5 max-w-prose text-sm">{order.notes}</p>
          </div>
        ) : null}
      </section>
    </article>
  );

  if (!draft) return label;
  return (
    <LabelEditor gone={t.gone} form={<DraftEditor order={order} now={now} action={action} language={language} />}>
      {label}
    </LabelEditor>
  );
}

/** A draft's lines, notes and expected date, opened up for writing; its supplier stays. */
async function DraftEditor({
  order,
  now,
  action,
  language,
}: {
  order: Order;
  now: Date;
  action: ReactNode;
  language: Language;
}) {
  const db = await getDb();
  const products = (await getOrderableProducts(db, now)).filter((p) => p.supplierId === order.supplierId);
  const catalog = new Map(products.map((p) => [p.id, p.unitCostCents]));
  return (
    <DraftForm
      money={await getMoneyPrefs()}
      language={language}
      order={{ id: order.id, number: order.number }}
      suppliers={[{ id: order.supplierId, name: order.supplierName, leadTimeDays: order.leadTimeDays }]}
      products={products}
      defaults={{
        supplierId: String(order.supplierId),
        lines: order.lines.map((line) => ({
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          catalogCents: catalog.get(line.productId) ?? line.unitCostCents,
          quantity: String(line.quantity),
          unitCost: centsToInput(line.unitCostCents),
        })),
        expectedAt: order.expectedAt ? dayInput(order.expectedAt) : "",
        notes: order.notes ?? "",
      }}
      today={dayInput(now)}
      action={action}
    />
  );
}

/**
 * Why the order is where it is, in one sentence. Late is the one state that needs
 * attention, so it's printed on yellow stock. Announced when an action changes it.
 */
function Status({ order, late, now, f, t }: { order: Order; late: boolean; now: Date; f: Formats; t: OrdersCopy }) {
  const s = t.statusText;
  let said: { lead: string; text: string };
  if (order.status === "draft") {
    said = s.draft(order.supplierName, order.expectedAt ? f.date(order.expectedAt, now) : null);
  } else if (order.status === "ordered") {
    const due = order.dueAt ? f.date(order.dueAt, now) : "–";
    const basis = order.expectedAt ? s.gaveDate : s.leadBasis(f.count(order.leadTimeDays));
    if (late && order.dueAt) {
      const overdue = Math.max(1, Math.floor((now.getTime() - order.dueAt.getTime()) / DAY_MS));
      said = s.late(due, f.days(overdue), basis);
    } else {
      said = s.onItsWay(due, basis);
    }
  } else {
    said = order.status === "received" ? s.received : s.cancelled;
  }
  const { lead, text } = said;

  return (
    <div
      id="order-status"
      tabIndex={-1}
      aria-live="polite"
      className={`border-b-2 border-ink px-5 py-3 outline-none sm:px-8 ${late ? "bg-stock" : ""}`}
    >
      <p className="max-w-prose text-sm">
        <strong className="font-bold">{lead}</strong> {text}
      </p>
    </div>
  );
}

function HistoryLine({ date, now, f, children }: { date: Date; now: Date; f: Formats; children: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="w-16 shrink-0 text-ink-2 lang-bn:w-24">{f.date(date, now)}</span>
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

/** The same label, unprinted, in the shape of what will print. */
export function OrderLabelPlaceholder({ language, action }: { language: Language; action?: ReactNode }) {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <div className="h-9 w-3/5 bg-liner sm:h-12" />
          <div className="mt-3 h-4 w-32 bg-liner/70" />
        </div>
        {action}
      </div>
      <TallyPlaceholder names={ORDERS_COPY[language].labelTallies} />
      <div className="border-b-2 border-ink px-5 py-3 sm:px-8">
        <div className="h-5 w-4/5 bg-liner/70" />
      </div>
      <div className="space-y-4 px-5 pt-6 sm:px-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-9 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
