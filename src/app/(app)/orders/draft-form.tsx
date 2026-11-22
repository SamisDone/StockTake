"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { FaultLine, FaultText } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { useLabelEditor } from "@/components/label-editor";
import { type Formats, formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { DOLLARS, type MoneyFormat, type MoneyPrefs, moneyFormat } from "@/lib/money";
import { centsToInput, parseCents, parseUnits } from "@/lib/parse";
import { duration, easing, reducedMotion } from "@/lib/motion";
import { useTicker } from "@/components/ticker";
import { type DraftFormState, saveDraft } from "@/server/order-actions";
import type { DraftLine, DraftValues, ProductChoice, SupplierChoice } from "./draft-values";
import { ORDERS_COPY, type OrdersCopy } from "./copy";

const initial: DraftFormState = {};

/** A line's figures as read from what was typed: null where they can't be read yet. */
function readLine(line: DraftLine) {
  const quantity = parseUnits(line.quantity);
  const cents = parseCents(line.unitCost);
  return { quantity, cents, total: quantity !== null && cents !== null ? quantity * cents : null };
}

/**
 * A draft written by hand: the order label's own Lines table with its figures opened up
 * for writing. Quantities and unit costs are typed in place, every total follows as
 * they're typed, and products are added from the supplier's catalog, running-low ones
 * first at the quantity the forecast suggests. A new order also picks its supplier; an
 * existing draft keeps its own. Nothing is sent until an admin places it.
 */
export function DraftForm({
  money,
  language,
  order,
  suppliers,
  products,
  defaults,
  today,
  action,
}: {
  /** How this person reads money. Unit costs are typed in dollars either way. */
  money: MoneyPrefs;
  language: Language;
  /** Set when editing a draft. Without it the form writes a new order. */
  order?: { id: number; number: string };
  /** Who a new order can go to; an existing draft passes only its own supplier. */
  suppliers: SupplierChoice[];
  /** What can go on a line, for every supplier offered. */
  products: ProductChoice[];
  defaults: DraftValues;
  /** Today as a date input holds it, the earliest expected date. */
  today: string;
  /** The way out, top right. */
  action: ReactNode;
}) {
  const editing = order !== undefined;
  const m = moneyFormat(money, language);
  const usd = moneyFormat(DOLLARS, language);
  const f = formats(language);
  const copy = ORDERS_COPY[language];
  const t = copy.form;
  const editor = useLabelEditor();
  const [state, dispatch, pending] = useActionState(saveDraft, initial);

  const [supplierId, setSupplierId] = useState(defaults.supplierId);
  const [lines, setLines] = useState(defaults.lines);
  const [added, setAdded] = useState<number | null>(null);
  const [picked, setPicked] = useState("");
  const [expectedAt, setExpectedAt] = useState(defaults.expectedAt);
  const [notes, setNotes] = useState(defaults.notes);
  const [said, setSaid] = useState("");
  // Lines on their way out: still on screen while they close, already off the order.
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(new Set());

  // Focus moves after the lines change: to a new line's quantity, or past a removed one.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    const target = document.getElementById(focusNext.current);
    focusNext.current = null;
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  });

  // A refused entry takes focus to the first field at fault, which is described by its message.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  useEffect(() => {
    if (state.saved && editing) editor?.close(t.saved);
    // Only a new answer means anything here. A new order redirects to its label instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved]);

  const supplier = suppliers.find((s) => String(s.id) === supplierId);
  const catalog = products.filter((p) => String(p.supplierId) === supplierId);
  const byId = new Map(products.map((p) => [p.id, p]));
  const kept = lines.filter((line) => !leaving.has(line.productId));
  const onOrder = new Set(kept.map((line) => line.productId));
  const available = catalog.filter((p) => !onOrder.has(p.id));
  const low = available.filter((p) => p.suggested > 0);
  const rest = available.filter((p) => p.suggested === 0).sort((a, b) => a.name.localeCompare(b.name));

  const read = lines.map(readLine);
  const counted = kept.map(readLine);
  const unread = counted.filter((r) => r.total === null).length;
  const totalCents = counted.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const units = counted.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
  const { shown: shownTotal } = useTicker(totalCents);
  const errors = state.fields ?? {};

  const update = (productId: number, change: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.productId === productId ? { ...line, ...change } : line)));

  const add = () => {
    const product = byId.get(Number(picked));
    if (!product) return;
    setLines((current) => [
      ...current,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        catalogCents: product.unitCostCents,
        quantity: String(product.quantity),
        unitCost: centsToInput(product.unitCostCents),
      },
    ]);
    setAdded(product.id);
    setPicked("");
    setSaid(t.added(product.name, f.count(product.quantity)));
    focusNext.current = `quantity-${product.id}`;
  };

  // A removed line comes off the order at once (the totals drop, its fields stop being
  // sent) and closes its gap on screen, so the lines below slide up rather than jump.
  const remove = (productId: number) => {
    const index = kept.findIndex((l) => l.productId === productId);
    if (index === -1) return;
    const line = kept[index];
    const neighbour = kept[index + 1] ?? kept[index - 1];
    setLeaving((current) => new Set(current).add(productId));
    setSaid(t.removed(line.name));
    focusNext.current = neighbour ? `remove-${neighbour.productId}` : "add-product";

    const gone = () => {
      setLines((current) => current.filter((l) => l.productId !== productId));
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    };
    const row = document.getElementById(`line-${productId}`);
    if (!row) return gone();
    row.style.overflow = "hidden";
    const reduce = reducedMotion();
    row
      .animate(
        reduce
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { height: `${row.offsetHeight}px`, opacity: 1 },
              { height: "0px", paddingBlock: "0px", borderBottomWidth: "0px", opacity: 0 },
            ],
        {
          duration: reduce ? duration("--dur-tear", 110) : duration("--dur-collapse", 200),
          easing: easing("--ease-out"),
          fill: "forwards",
        },
      )
      .finished.then(gone, gone);
  };

  const chooseSupplier = (next: string) => {
    setSupplierId(next);
    setPicked("");
    if (lines.length > 0) {
      setLines([]);
      setSaid(t.cleared);
    }
  };

  const leadTime = supplier?.leadTimeDays;

  return (
    <form
      ref={formRef}
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        // Sent by hand so React doesn't reset the form: every field here is held in state.
        event.preventDefault();
        editor?.returnFocus();
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
      }}
      onKeyDown={(event) => {
        if (editing && event.key === "Escape" && editor) {
          event.preventDefault();
          editor.close();
        }
      }}
    >
      {order ? <input type="hidden" name="orderId" value={order.id} /> : null}
      <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 id="order-title" className="text-lg font-bold">
            {order ? t.editTitle(order.number) : t.newTitle}
          </h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            {editing ? t.editHelp(supplier?.name ?? null) : t.newHelp}
          </p>
        </div>
        {action}
      </header>

      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">{editing ? t.editLegend : t.newLegend}</legend>

        {editing ? null : (
          <div className="border-t-2 border-ink">
            <Field
              name="supplierId"
              label={t.supplier}
              language={language}
              error={errors.supplierId}
              hint={supplier ? t.supplierHint(f.count(supplier.leadTimeDays), lines.length > 0) : t.supplierNone}
            >
              <div className="relative">
                <select
                  {...fieldProps("supplierId", { error: errors.supplierId, hint: true })}
                  value={supplierId}
                  onChange={(event) => chooseSupplier(event.target.value)}
                  autoFocus
                  className="field-input cursor-pointer appearance-none pr-8"
                >
                  <option value="">{t.chooseSupplier}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  size={18}
                  strokeWidth={2}
                  className="pointer-events-none absolute top-[calc(50%-0.1875rem)] right-0 -translate-y-1/2"
                />
              </div>
            </Field>
          </div>
        )}

        <section aria-labelledby="draft-lines-title" className="border-t-2 border-ink pt-5">
          <h2 id="draft-lines-title" className="px-5 text-lg font-bold sm:px-8">
            {t.lines}
          </h2>

          {lines.length === 0 ? (
            <p className="mt-2 max-w-prose px-5 pb-4 text-sm text-ink-2 sm:px-8">
              {t.nothingYet(supplier?.name ?? null)}
            </p>
          ) : (
            <div className="mt-3">
              <div
                aria-hidden
                className="grid grid-cols-[minmax(0,1fr)_7rem_8.5rem_7rem_2.75rem] gap-x-3 border-b border-ink px-5 pb-2 max-md:hidden sm:px-8"
              >
                <span className="field-name">{t.columns.product}</span>
                <span className="field-name text-right">{t.columns.quantity}</span>
                <span className="field-name text-right">{t.columns.unitCost}</span>
                <span className="field-name text-right">{t.columns.lineTotal}</span>
                <span />
              </div>
              <ul>
                {lines.map((line, index) => (
                  <LineRow
                    key={line.productId}
                    line={line}
                    figures={read[index]}
                    product={byId.get(line.productId)}
                    errors={errors}
                    m={m}
                    usd={usd}
                    f={f}
                    t={copy}
                    fresh={line.productId === added}
                    leaving={leaving.has(line.productId)}
                    onChange={(change) => update(line.productId, change)}
                    onRemove={() => remove(line.productId)}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-end gap-2 border-t border-hairline px-5 pt-3 pb-4 sm:px-8">
            <div className="min-w-0 flex-1">
              <label htmlFor="add-product" className="field-name block">
                {t.addProduct}
              </label>
              <div className="relative mt-1">
                <select
                  id="add-product"
                  value={picked}
                  onChange={(event) => setPicked(event.target.value)}
                  disabled={!supplier || available.length === 0}
                  className="h-11 w-full cursor-pointer appearance-none rounded-none border border-ink bg-label pr-9 pl-2.5 text-base font-medium outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] disabled:cursor-default disabled:border-hairline disabled:text-ink-3"
                >
                  <option value="">
                    {!supplier
                      ? t.supplierFirst
                      : catalog.length === 0
                        ? t.nothingElse(supplier.name)
                        : available.length === 0
                          ? t.allOn(supplier.name)
                          : t.chooseProduct}
                  </option>
                  {low.length > 0 ? (
                    <optgroup label={t.runningLow}>
                      {low.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t.orderSuggested(p.name, f.count(p.suggested))}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {rest.length > 0 ? (
                    <optgroup label={low.length > 0 ? t.everythingElse : t.from(supplier?.name ?? "")}>
                      {rest.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <ChevronDown
                  aria-hidden
                  size={18}
                  strokeWidth={2}
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!picked}
              className="press-quiet flex h-11 shrink-0 items-center gap-1.5 rounded-control px-3.5 font-semibold text-ink enabled:hover:bg-liner disabled:text-ink-3"
            >
              <Plus aria-hidden size={18} strokeWidth={2.25} />
              {t.add}
            </button>
          </div>

          {/* The total, reverse-printed as on the label, following every figure typed. A line
              whose figures can't be read yet is left out, and it says so. */}
          <div className="flex items-baseline justify-between gap-4 bg-ink px-5 py-3 text-label sm:px-8">
            <p className="min-w-0 font-semibold">
              {t.total}
              <span className="ml-2 text-sm font-normal">
                {t.totals(kept.length, f.count(kept.length), units, f.count(units))}
                {unread > 0 ? t.uncounted(unread, f.count(unread)) : null}
              </span>
            </p>
            <p className="print-display tabular shrink-0 text-[1.75rem] sm:text-5xl">{m.money(shownTotal)}</p>
          </div>
        </section>

        <div className="grid gap-px border-b-2 border-ink bg-ink sm:grid-cols-2">
          <Field
            name="expectedAt"
            label={t.expected}
            language={language}
            optional
            error={errors.expectedAt}
            hint={
              supplier && leadTime !== undefined ? t.expectedHint(supplier.name, f.count(leadTime)) : t.expectedNone
            }
          >
            <input
              {...fieldProps("expectedAt", { error: errors.expectedAt, hint: true })}
              type="date"
              min={today}
              value={expectedAt}
              onChange={(event) => setExpectedAt(event.target.value)}
              className="field-input"
            />
          </Field>
          <Field name="notes" label={t.notes} language={language} optional error={errors.notes}>
            <textarea
              {...fieldProps("notes", { error: errors.notes })}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={2}
              className="field-input resize-y text-base font-normal"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
          {/* Holds a line beside the buttons for "Saving…" and then for a refusal, so
              neither moves the button that was just pressed. */}
          <div className="min-h-5 min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p role="status" className="text-sm font-medium">
              {pending ? (editing ? t.saving : t.drafting) : null}
            </p>
            <FaultLine message={pending ? undefined : state.error?.message} hold={false} />
          </div>
          {editing ? (
            <button
              type="button"
              onClick={() => editor?.close()}
              className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
            >
              {t.cancel}
            </button>
          ) : null}
          <button
            type="submit"
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {editing ? t.save : t.draft}
            </span>
          </button>
        </div>
      </fieldset>

      <p role="status" className="sr-only">
        {said}
      </p>
    </form>
  );
}

/**
 * One line, as a row of the label's table. On a phone the product takes its own row
 * and the figures sit below it, each with its name; at the desk they share one row
 * under the table's heading.
 */
function LineRow({
  line,
  figures,
  product,
  errors,
  m,
  usd,
  f,
  t: copy,
  fresh,
  leaving,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  figures: ReturnType<typeof readLine>;
  product: ProductChoice | undefined;
  errors: Record<string, string>;
  m: MoneyFormat;
  /** Dollars in the reader's digits: what the cost fields take. */
  usd: MoneyFormat;
  f: Formats;
  t: OrdersCopy;
  /** Just added: it prints in. */
  fresh: boolean;
  /** Removed and closing: off the order already, so nothing in it is sent or reachable. */
  leaving: boolean;
  onChange: (change: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const t = copy.form;
  const qtyKey = `quantity-${line.productId}`;
  const costKey = `unitCost-${line.productId}`;
  const qtyError = errors[qtyKey];
  const costError = errors[costKey];

  return (
    <li
      id={`line-${line.productId}`}
      inert={leaving}
      className={`grid grid-cols-3 gap-x-3 gap-y-2 border-b border-hairline px-5 py-3 last:border-b-0 sm:px-8 md:grid-cols-[minmax(0,1fr)_7rem_8.5rem_7rem_2.75rem] md:items-start ${fresh ? "print-in" : ""}`}
    >
      <input type="hidden" name="productId" value={line.productId} disabled={leaving} />
      <div className="min-w-0 max-md:col-span-2 md:pt-2.5">
        <p className="font-semibold">{line.name}</p>
        <p className="text-xs text-ink-3">
          <span className="font-mono">{line.sku}</span>
          {product ? t.onHand(f.count(product.onHand)) : null}
          <span id={`${costKey}-usual`}>
            {/* The field takes dollars, so the usual cost is in dollars too, converted after it for taka. */}
            {t.usually}
            {usd.money(line.catalogCents)}
            {m.hint(line.catalogCents) ? ` (${m.hint(line.catalogCents)})` : null}
          </span>
          {product && product.suggested > 0 ? t.forecast(f.count(product.suggested)) : null}
        </p>
      </div>

      <div className="min-w-0">
        <label htmlFor={qtyKey} className="field-name block md:sr-only">
          {t.columns.quantity}
          <span className="sr-only">{t.quantityOf(line.name)}</span>
        </label>
        <div
          className={`flex h-11 items-center border bg-label px-2.5 focus-within:shadow-[inset_0_0_0_1px_var(--color-ink)] ${qtyError ? "border-fault shadow-[inset_0_0_0_1px_var(--color-fault)]" : "border-ink"}`}
        >
          <input
            id={qtyKey}
            name="quantity"
            disabled={leaving}
            value={line.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={qtyError ? true : undefined}
            aria-describedby={qtyError ? `${qtyKey}-error` : undefined}
            className="tabular w-full min-w-0 bg-transparent text-right text-base font-medium outline-none"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor={costKey} className="field-name block md:sr-only">
          {t.columns.unitCost}
          <span className="sr-only">{t.quantityOf(line.name)}</span>
        </label>
        <div
          className={`flex h-11 items-center gap-1 border bg-label px-2.5 focus-within:shadow-[inset_0_0_0_1px_var(--color-ink)] ${costError ? "border-fault shadow-[inset_0_0_0_1px_var(--color-fault)]" : "border-ink"}`}
        >
          <span aria-hidden className="text-ink-3">
            $
          </span>
          <input
            id={costKey}
            name="unitCost"
            disabled={leaving}
            value={line.unitCost}
            onChange={(event) => onChange({ unitCost: event.target.value })}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={costError ? true : undefined}
            aria-describedby={costError ? `${costKey}-error` : `${costKey}-usual`}
            className="tabular w-full min-w-0 bg-transparent text-right text-base font-medium outline-none"
          />
        </div>
      </div>

      <div className="min-w-0 text-right">
        <p aria-hidden className="field-name md:hidden">
          {t.columns.lineTotal}
        </p>
        <p className="tabular font-semibold md:pt-2.5">{figures.total === null ? "–" : m.money(figures.total)}</p>
      </div>

      <button
        type="button"
        id={`remove-${line.productId}`}
        onClick={onRemove}
        aria-label={t.remove(line.name)}
        className="press-quiet flex size-11 items-center justify-center justify-self-end rounded-control text-ink-2 hover:bg-liner hover:text-ink max-md:col-start-3 max-md:row-start-1 max-md:-mt-2 max-md:-mr-3"
      >
        <X aria-hidden size={18} strokeWidth={2.25} />
      </button>

      {qtyError || costError ? (
        <div role="alert" className="col-span-full space-y-1">
          {qtyError ? <FaultText id={`${qtyKey}-error`}>{qtyError}</FaultText> : null}
          {costError ? <FaultText id={`${costKey}-error`}>{costError}</FaultText> : null}
        </div>
      ) : null}
    </li>
  );
}
