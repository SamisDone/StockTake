"use client";

import { Archive, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Field, fieldProps } from "@/components/field";
import { formatCount, formatMargin } from "@/lib/format";
import { type MoneyFormat, type MoneyPrefs, moneyFormat } from "@/lib/money";
import { parseCents } from "@/lib/parse";
import {
  type ArchiveFormState,
  type ProductFormState,
  saveProduct,
  setProductArchived,
} from "@/server/product-actions";
import { useLabelEditor } from "@/components/label-editor";
import type { ArchiveFacts, ProductValues, SupplierOption } from "./product-values";

const initial: ProductFormState = {};

/**
 * A product's details as boxed fields: a new product, or an existing one edited in
 * place on its label. Nothing about stock is here; on hand only changes through the
 * ledger. Sent fields come back with every problem at once, each next to its field.
 */
export function ProductForm({
  productId,
  money,
  defaults,
  suppliers,
  categories,
  defaultLeadTimeDays,
  headingLevel,
  action,
  archive,
}: {
  /** Set when editing. Without it the form adds a product. */
  productId?: number;
  /** How this person reads money; amounts are typed in dollars either way. */
  money: MoneyPrefs;
  defaults: ProductValues;
  suppliers: SupplierOption[];
  categories: string[];
  defaultLeadTimeDays: number;
  headingLevel: 1 | 2;
  /** The way out, top right: the drawer's Close space or the page's link back. */
  action: ReactNode;
  archive?: ArchiveFacts;
}) {
  const editing = productId !== undefined;
  const m = moneyFormat(money);
  const editor = useLabelEditor();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveProduct, initial);
  const values = state.values ?? defaults;

  // React resets the fields after each send to their defaults, which are the answer's
  // values. Supplier, cost and price are mirrored here for the help lines that follow them.
  const [answered, setAnswered] = useState(state);
  const [supplierId, setSupplierId] = useState(values.supplierId);
  const [cost, setCost] = useState(values.unitCost);
  const [price, setPrice] = useState(values.unitPrice);
  if (answered !== state) {
    setAnswered(state);
    setSupplierId(values.supplierId);
    setCost(values.unitCost);
    setPrice(values.unitPrice);
  }

  // A refused entry takes focus to the first field at fault, which is described by its message.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.fields) formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus();
  }, [state.fields]);

  useEffect(() => {
    if (!state.saved) return;
    if (editing) editor?.close("Saved changes.");
    // The new product's own label takes the form's place, at its own URL; Back goes
    // to where the form was opened from.
    else router.replace(`/products/${state.saved.id}`, { scroll: false });
    // Only a new answer means anything here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved]);

  const errors = state.fields ?? {};
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const supplier = suppliers.find((s) => String(s.id) === supplierId);
  const costCents = parseCents(cost);
  const priceCents = parseCents(price);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        noValidate
        aria-busy={pending}
        onSubmit={() => editor?.returnFocus()}
        onKeyDown={(event) => {
          // Inside the drawer Escape would close it; while editing it means "stop editing".
          if (editing && event.key === "Escape" && editor) {
            event.preventDefault();
            editor.close();
          }
        }}
      >
        {editing ? <input type="hidden" name="productId" value={productId} /> : null}
        <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <Heading id="product-title" className="text-lg font-bold">
              {editing ? "Edit details" : "New product"}
            </Heading>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              {editing
                ? "Changes go in the activity log. On hand isn't here: it only changes through the ledger."
                : "It starts with no stock. Once it's added, count what's on the shelf to open its ledger."}
            </p>
          </div>
          {action}
        </header>

        <fieldset disabled={pending} className="min-w-0">
          <legend className="sr-only">{editing ? "Product details" : "The new product"}</legend>
          {/* Two columns at every width: short pairs (cost and price, the reorder pair) sit side
              by side even on a phone; everything else spans. */}
          <div className="grid grid-cols-2 gap-px border-y-2 border-ink bg-ink">
            <Field name="name" label="Name" error={errors.name} className="col-span-2">
              <input
                {...fieldProps("name", { error: errors.name })}
                defaultValue={values.name}
                maxLength={120}
                autoComplete="off"
                autoFocus
                data-autofocus
                className="field-input print-display text-3xl leading-tight font-extrabold sm:text-4xl"
              />
            </Field>

            <Field
              name="sku"
              label="SKU"
              error={errors.sku}
              className="max-sm:col-span-2"
              hint="Letters, numbers, dots, dashes or underscores. Printed in capitals."
            >
              <input
                {...fieldProps("sku", { error: errors.sku, hint: true })}
                defaultValue={values.sku}
                maxLength={32}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="field-input font-mono text-base uppercase"
              />
            </Field>
            <Field
              name="category"
              label="Category"
              optional
              error={errors.category}
              hint="Pick one in use, or name a new one."
              className="max-sm:col-span-2"
            >
              <input
                {...fieldProps("category", { error: errors.category, hint: true })}
                defaultValue={values.category}
                list="product-categories"
                maxLength={60}
                autoComplete="off"
                className="field-input"
              />
              <datalist id="product-categories">
                {categories.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>

            <Field
              name="supplierId"
              label="Supplier"
              error={errors.supplierId}
              className="col-span-2"
              hint={
                supplier
                  ? `Delivers in ${formatCount(supplier.leadTimeDays)} days, which is the lead time cover is measured against.`
                  : `With no supplier, cover is measured against a ${defaultLeadTimeDays}-day lead time.`
              }
            >
              <div className="relative">
                <select
                  {...fieldProps("supplierId", { error: errors.supplierId, hint: true })}
                  defaultValue={values.supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="field-input cursor-pointer appearance-none pr-8"
                >
                  <option value="">No supplier</option>
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

            <MoneyField
              name="unitCost"
              label="Unit cost"
              error={errors.unitCost}
              defaultValue={values.unitCost}
              onChange={setCost}
              converted={costCents === null ? null : m.hint(costCents)}
              hint="What one unit costs from the supplier."
            />
            <MoneyField
              name="unitPrice"
              label="Unit price"
              error={errors.unitPrice}
              defaultValue={values.unitPrice}
              onChange={setPrice}
              converted={priceCents === null ? null : m.hint(priceCents)}
              hint={
                priceCents === null || costCents === null
                  ? "What one unit sells for."
                  : priceCents === 0
                    ? "No price, so no margin."
                    : `${formatMargin(costCents, priceCents)} margin at ${m.money(costCents)} cost.`
              }
            />

            <UnitsField
              name="reorderPoint"
              label="Reorder point"
              error={errors.reorderPoint}
              defaultValue={values.reorderPoint}
              hint="Units. Flagged for reorder when on hand and on order fall to this."
            />
            <UnitsField
              name="reorderQuantity"
              label="Reorder quantity"
              error={errors.reorderQuantity}
              defaultValue={values.reorderQuantity}
              hint="Units. The smallest order to suggest."
            />

            <Field name="description" label="Description" optional error={errors.description} className="col-span-2">
              <textarea
                {...fieldProps("description", { error: errors.description })}
                defaultValue={values.description}
                maxLength={2000}
                rows={2}
                className="field-input resize-y text-base font-normal"
              />
            </Field>
          </div>

          {state.error ? (
            <p role="alert" className="bg-stock px-5 py-3 text-sm font-medium sm:px-8">
              {state.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
            <p role="status" className="min-h-5 min-w-0 basis-full text-sm font-medium sm:basis-auto sm:flex-1">
              {pending ? (editing ? "Saving…" : "Adding…") : null}
            </p>
            {editing ? (
              <button
                type="button"
                onClick={() => editor?.close()}
                className="min-h-12 rounded-control px-4 press-quiet font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
            >
              <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {editing ? "Save changes" : "Add product"}
              </span>
            </button>
          </div>
        </fieldset>
      </form>

      {archive ? <ArchiveZone facts={archive} m={m} headingLevel={headingLevel === 1 ? 2 : 3} /> : null}
    </>
  );
}

/**
 * Dollars and cents, with the dollar sign printed in the field rather than typed. Stock
 * is kept in dollars, so that's what's typed; someone reading in taka sees the figure
 * converted at the end of the hint.
 */
function MoneyField({
  name,
  label,
  error,
  hint,
  converted,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  error?: string;
  hint: string;
  converted: string | null;
  defaultValue: string;
  onChange: (text: string) => void;
}) {
  return (
    <Field name={name} label={label} error={error} hint={converted ? `${hint} ${converted}` : hint}>
      <div className="flex items-baseline gap-1">
        <span aria-hidden className={`text-lg font-medium ${error ? "text-ink" : "text-ink-3"}`}>
          $
        </span>
        <input
          {...fieldProps(name, { error, hint: true })}
          defaultValue={defaultValue}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          className="field-input min-w-0"
        />
      </div>
    </Field>
  );
}

function UnitsField({
  name,
  label,
  error,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  error?: string;
  hint: string;
  defaultValue: string;
}) {
  return (
    <Field name={name} label={label} error={error} hint={hint}>
      <input
        {...fieldProps(name, { error, hint: true })}
        defaultValue={defaultValue}
        inputMode="numeric"
        autoComplete="off"
        className="field-input"
      />
    </Field>
  );
}

const archiveInitial: ArchiveFormState = {};

/**
 * Below the form, apart from it: archiving isn't an edit. It says what it will do
 * before it's done; a refusal (the product is still on an open order) prints here.
 * Once archived, the refreshed label has no form, so the editor prints the label
 * again, archived and with Restore, so it's undone in one press.
 */
function ArchiveZone({ facts, m, headingLevel }: { facts: ArchiveFacts; m: MoneyFormat; headingLevel: 2 | 3 }) {
  const editor = useLabelEditor();
  const [state, formAction, pending] = useActionState(setProductArchived, archiveInitial);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby="archive-title" className="border-t-2 border-ink">
      <form action={formAction} aria-busy={pending} onSubmit={() => editor?.returnFocus()}>
        <input type="hidden" name="productId" value={facts.productId} />
        <input type="hidden" name="intent" value="archive" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 pb-5 sm:px-8">
          <div className="min-w-0 flex-1 basis-80">
            <Heading id="archive-title" className="text-lg font-bold">
              Archive
            </Heading>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              Takes {facts.name} off the list and freezes its stock. The ledger stays, and an admin can restore it.
              {facts.onHand > 0
                ? ` Its ${formatCount(facts.onHand)} units on hand, ${m.money(facts.valueCents)} at cost, leave the totals while it's archived.`
                : null}
            </p>
            {/* Holds its line while empty, so nothing moves when it speaks. */}
            <p role="status" className="mt-1 min-h-5 text-sm font-medium">
              {pending ? "Archiving…" : null}
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="group flex min-h-12 shrink-0 items-center gap-2 rounded-control px-4 font-semibold text-ink-2 transition-colors duration-150 enabled:hover:bg-liner enabled:hover:text-ink disabled:cursor-progress max-sm:w-full max-sm:justify-center"
          >
            <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              <Archive aria-hidden size={18} strokeWidth={2.25} />
              Archive product
            </span>
          </button>
        </div>
        {state.error ? (
          <p role="alert" className="bg-stock px-5 py-3 text-sm font-medium sm:px-8">
            {state.error.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
