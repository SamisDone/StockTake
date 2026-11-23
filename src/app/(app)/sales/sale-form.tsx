"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { type PaymentMethod, paymentMethods } from "@/db/schema";
import { Choice, Choices } from "@/components/choice";
import { useDiscardGuard } from "@/components/discard-guard";
import { FaultLine } from "@/components/fault";
import { Field, fieldProps } from "@/components/field";
import { ProductPicker } from "@/components/product-picker";
import { useTicker } from "@/components/ticker";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { centsToInput, parseCents, parseUnits } from "@/lib/parse";
import { type SaleFormState, saveSale } from "@/server/sale-actions";
import { SALES_COPY } from "./copy";
import type { CustomerChoice, SaleProduct } from "./sale-values";

const initial: SaleFormState = {};

/** One line as the form holds it: the product's facts, and its figures as typed. */
type Line = SaleProduct & { quantity: string; price: string; discount: string };

/** Cents from a typed amount; an empty field is 0, anything unreadable is null. */
const cents = (text: string) => (text.trim() === "" ? 0 : parseCents(text));

/**
 * Writing a sale: who's buying (a customer, or a walk-in who pays now), the products
 * with their quantities, prices and any discount, a discount on the whole sale, and
 * what's paid now. Totals follow as it's typed; Paid starts at the total and follows it
 * until it's changed. What's left is the customer's due. The server has the last word,
 * and a recorded sale opens on its own label.
 */
export function SaleForm({
  products,
  customers,
  defaultCustomerId,
  money,
  language,
  action,
}: {
  products: SaleProduct[];
  customers: CustomerChoice[];
  defaultCustomerId: number | null;
  money: MoneyPrefs;
  language: Language;
  action: ReactNode;
}) {
  const t = SALES_COPY[language];
  const ft = t.form;
  const f = formats(language);
  const m = moneyFormat(money, language);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState(saveSale, initial);
  const [customerId, setCustomerId] = useState(defaultCustomerId ? String(defaultCustomerId) : "");
  const [lines, setLines] = useState<Line[]>([]);
  const [saleDiscount, setSaleDiscount] = useState("");
  // Null while Paid follows the total.
  const [paid, setPaid] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const discard = useDiscardGuard(formRef, language);
  const fields = state.fields ?? {};

  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  const gross = lines.map((line) => {
    const quantity = parseUnits(line.quantity) ?? 0;
    const price = cents(line.price) ?? 0;
    const discount = cents(line.discount) ?? 0;
    return quantity * price - discount;
  });
  const subtotal = gross.reduce((sum, value) => sum + value, 0);
  const total = subtotal - (cents(saleDiscount) ?? 0);
  const paidText = paid ?? centsToInput(Math.max(total, 0));
  const paidCents = cents(paidText) ?? 0;
  const due = total - paidCents;
  const customer = customers.find((c) => String(c.id) === customerId) ?? null;
  // The total counts over to each new figure, like the draft order's.
  const { shown: shownTotal } = useTicker(Math.max(total, 0));

  const onShelf = products.filter((p) => p.onHand > 0 && !lines.some((line) => line.id === p.id));
  const add = (product: SaleProduct) =>
    setLines((current) => [
      ...current,
      { ...product, quantity: "1", price: centsToInput(product.priceCents), discount: "" },
    ]);
  const change = (id: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  const remove = (id: number) => setLines((current) => current.filter((line) => line.id !== id));

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 className="print-display text-2xl sm:text-3xl">{ft.title}</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{ft.help}</p>
        </div>
        {action}
      </header>

      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">{ft.title}</legend>

        {/* Who's buying. */}
        <div className="grid border-y-2 border-ink sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field
            name="customerId"
            label={ft.customer}
            language={language}
            error={fields.customerId}
            hint={
              customer && customer.dueCents > 0
                ? t.status.due(m.money(customer.dueCents), customer.name).lead
                : ft.customerHint
            }
          >
            <select
              {...fieldProps("customerId", { error: fields.customerId, hint: true })}
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="field-input appearance-none"
            >
              <option value="">{ft.walkInOption}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center border-ink px-5 pb-3 sm:border-l sm:px-8 sm:pb-0">
            <Link
              href="/customers/new"
              className="text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
            >
              {ft.addCustomer}
            </Link>
          </div>
        </div>

        {/* What's sold. */}
        <section aria-labelledby="sale-lines-title" className="pt-5">
          <h2 id="sale-lines-title" className="px-5 text-lg font-bold sm:px-8">
            {ft.lines}
          </h2>
          <div className="mt-3 px-5 sm:px-8">
            <label htmlFor="sale-add-product" className="field-name mb-1 block">
              {ft.addProduct}
            </label>
            <ProductPicker
              id="sale-add-product"
              groups={[{ name: null, items: onShelf }]}
              placeholder={onShelf.length === 0 && lines.length === 0 ? ft.nothingToSell : ft.pickProduct}
              disabled={pending || onShelf.length === 0}
              onPick={add}
              listLabel={ft.addProduct}
              noMatch={ft.pickerNoMatch}
              detail={(p) => (
                <>
                  <span className="font-mono text-xs">{p.sku}</span> · {ft.pickerOnHand(f.count(p.onHand))}
                </>
              )}
              aside={(p) => <span className="tabular font-semibold">{m.money(p.priceCents)}</span>}
            />
          </div>

          {lines.length === 0 ? (
            <p className="px-5 pt-4 pb-2 text-sm text-ink-2 sm:px-8">{ft.noLines}</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-left text-sm">
              <thead className="max-md:hidden">
                <tr className="border-b border-ink">
                  <th scope="col" className="field-name w-full pt-1 pr-4 pb-2 pl-5 sm:pl-8">
                    {ft.product}
                  </th>
                  <th scope="col" className="field-name pt-1 pr-3 pb-2 text-right">
                    {ft.quantity}
                  </th>
                  <th scope="col" className="field-name pt-1 pr-3 pb-2 text-right whitespace-nowrap">
                    {ft.price}
                  </th>
                  <th scope="col" className="field-name pt-1 pr-3 pb-2 text-right">
                    {ft.discount}
                  </th>
                  <th scope="col" className="field-name pt-1 pr-3 pb-2 text-right whitespace-nowrap">
                    {ft.lineTotal}
                  </th>
                  <th scope="col" className="pr-5 sm:pr-8">
                    <span className="sr-only">{ft.remove("")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const quantity = parseUnits(line.quantity) ?? 0;
                  const listed = cents(line.price) === line.priceCents;
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-hairline align-top last:border-b-0 max-md:grid max-md:grid-cols-3 max-md:gap-x-3 max-md:gap-y-1 max-md:px-5 max-md:py-3 sm:max-md:px-8"
                    >
                      <td className="py-2.5 pr-4 pl-5 max-md:col-span-2 max-md:p-0 sm:pl-8">
                        <input type="hidden" name="productId" value={line.id} />
                        <p className="font-semibold">{line.name}</p>
                        <p className="text-xs text-ink-2">
                          <span className="font-mono">{line.sku}</span> ·{" "}
                          <span className={quantity > line.onHand ? "font-semibold text-fault" : ""}>
                            {ft.left(f.count(line.onHand - quantity))}
                          </span>
                        </p>
                      </td>
                      <td className="-mt-2 -mr-2 text-right md:hidden">
                        <RemoveButton label={ft.remove(line.name)} onRemove={() => remove(line.id)} />
                      </td>
                      <NumberCell
                        name="quantity"
                        id={`quantity-${line.id}`}
                        label={ft.quantity}
                        value={line.quantity}
                        onChange={(value) => change(line.id, { quantity: value })}
                        error={fields[`quantity-${line.id}`]}
                        width="w-16"
                        inputMode="numeric"
                      />
                      <NumberCell
                        name="unitPrice"
                        id={`price-${line.id}`}
                        label={ft.price}
                        value={line.price}
                        onChange={(value) => change(line.id, { price: value })}
                        error={fields[`price-${line.id}`]}
                        width="w-24"
                        note={listed ? null : ft.listPrice(m.money(line.priceCents))}
                      />
                      <NumberCell
                        name="discount"
                        id={`discount-${line.id}`}
                        label={ft.discount}
                        value={line.discount}
                        onChange={(value) => change(line.id, { discount: value })}
                        error={fields[`discount-${line.id}`]}
                        width="w-20"
                        placeholder="0.00"
                      />
                      {/* Level with the figures in the inputs beside it. */}
                      <td className="tabular py-2.5 pr-3 text-right font-semibold whitespace-nowrap md:pt-3.5 max-md:col-span-full max-md:flex max-md:justify-between max-md:p-0">
                        <span className="field-name md:hidden">{ft.lineTotal}</span>
                        {m.money(gross[index])}
                      </td>
                      <td className="py-1.5 pr-5 text-right max-md:hidden sm:pr-8">
                        <RemoveButton label={ft.remove(line.name)} onRemove={() => remove(line.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* What it comes to, and what's paid. */}
        <div className="mt-4 border-t-2 border-ink">
          <div className="grid sm:grid-cols-2">
            <div className="flex items-baseline justify-between gap-4 border-b border-ink px-5 py-3 sm:border-r sm:px-8">
              <span className="field-name">{ft.subtotal}</span>
              <span className="tabular font-semibold">{m.money(subtotal)}</span>
            </div>
            <Field
              name="saleDiscount"
              label={ft.saleDiscount}
              language={language}
              error={fields.discount}
              className="border-b border-ink"
              hint={m.hint(cents(saleDiscount) ?? 0) ?? undefined}
            >
              <input
                {...fieldProps("saleDiscount", { error: fields.discount, hint: money.currency === "BDT" })}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={saleDiscount}
                onChange={(event) => setSaleDiscount(event.target.value)}
                className="field-input tabular"
              />
            </Field>
          </div>
          <div className="flex items-baseline justify-between gap-4 bg-ink px-5 py-3 text-label sm:px-8">
            <p className="font-semibold">{ft.total}</p>
            <p className="print-display text-[1.75rem] sm:text-5xl">{m.money(Math.round(shownTotal))}</p>
          </div>
          <div className="grid border-b border-ink sm:grid-cols-2">
            <Field
              name="paid"
              label={ft.paid}
              language={language}
              error={fields.paid}
              className="border-ink max-sm:border-b sm:border-r"
              hint={m.hint(paidCents) ?? undefined}
            >
              <input
                {...fieldProps("paid", { error: fields.paid, hint: money.currency === "BDT" })}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={paidText}
                onChange={(event) => setPaid(event.target.value)}
                className="field-input tabular"
              />
            </Field>
            <Choices legend={ft.method} className="border-b-0">
              {paymentMethods.map((value) => (
                <Choice
                  key={value}
                  name="method"
                  value={value}
                  checked={method === value}
                  onSelect={() => setMethod(value)}
                >
                  {t.methods[value]}
                </Choice>
              ))}
            </Choices>
          </div>
          {/* What's left after what's paid: on the customer's account, or nothing. */}
          <p
            aria-live="polite"
            className={`border-b-2 border-ink px-5 py-3 text-sm sm:px-8 ${due > 0 && customer ? "bg-stock" : ""}`}
          >
            {lines.length === 0 ? (
              <span className="text-ink-2">{ft.nothingYet}</span>
            ) : due > 0 ? (
              <>
                <strong className="font-bold">
                  {ft.due} {m.money(due)}.
                </strong>{" "}
                {customer ? ft.dueOnAccount(customer.name) : t.form.customerHint}
              </>
            ) : (
              <strong className="font-bold">{ft.paidInFull}</strong>
            )}
          </p>
        </div>

        <Field name="note" label={ft.note} language={language} optional className="border-b border-ink">
          <textarea
            {...fieldProps("note")}
            rows={2}
            maxLength={500}
            className="field-input resize-y text-base font-normal"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-6 sm:px-8">
          <div className="min-h-5 min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <p role="status" className="text-sm font-medium">
              {pending ? ft.saving : null}
            </p>
            <FaultLine message={pending ? undefined : state.error?.message} hold={false} />
          </div>
          <button
            type="submit"
            disabled={lines.length === 0}
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {ft.submit}
            </span>
          </button>
        </div>
      </fieldset>
      {discard.dialog}
    </form>
  );
}

/** A figure typed into a line: a boxed input in its cell, its fault under it. */
function NumberCell({
  name,
  id,
  label,
  value,
  onChange,
  error,
  width,
  note,
  placeholder,
  inputMode = "decimal",
}: {
  name: string;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  width: string;
  note?: string | null;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <td className="py-1.5 pr-3 align-top max-md:p-0 md:text-right">
      <label htmlFor={id} className="field-name block md:sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`tabular h-10 ${width} rounded-none border bg-label px-2 text-right font-semibold outline-none placeholder:font-normal placeholder:text-ink-3 focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] max-md:w-full ${
          error ? "fault-rule border-fault" : "border-ink"
        }`}
      />
      {note ? <p className="mt-0.5 text-xs whitespace-nowrap text-ink-3">{note}</p> : null}
      <FaultLine id={`${id}-error`} message={error} className="pt-1 text-left" />
    </td>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={label}
      className="inline-flex size-10 items-center justify-center rounded-control text-ink-2 press-quiet hover:bg-liner hover:text-ink pointer-coarse:size-11"
    >
      <X aria-hidden size={18} strokeWidth={2.25} />
    </button>
  );
}
