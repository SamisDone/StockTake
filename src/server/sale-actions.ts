"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { type PaymentMethod, paymentMethods } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { type SaleInput, recordSale, voidSale } from "@/domain/sales";
import { parseCents, parseUnits } from "@/lib/parse";
import { ACTION_COPY } from "./action-copy";
import { authorize } from "./dal";
import { type FormState, field, formError } from "./form-state";

/** What the sale form gets back: a message per field at fault (lines keyed by product), or one for the whole sale. */
export type SaleFormState = {
  fields?: Record<string, string>;
  error?: { message: string };
};

const MAX_UNITS = 1_000_000;

const positiveId = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Records a sale from the sale form. Anyone can sell. Every problem with a figure comes
 * back at once, next to its field; a line's fields are keyed by its product
 * (quantity-ID, price-ID, discount-ID). A recorded sale opens on its own label.
 */
export async function saveSale(_previous: SaleFormState, formData: FormData): Promise<SaleFormState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const fields: Record<string, string> = {};

  const customerText = field(formData, "customerId");
  const customerId = customerText ? positiveId(customerText) : null;
  if (customerText && customerId === null) fields.customerId = t.noCustomer;

  const all = (name: string) => formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
  const [ids, quantities, prices, discounts] = [all("productId"), all("quantity"), all("unitPrice"), all("discount")];
  const lines: SaleInput["lines"] = [];
  const productIds: number[] = [];
  ids.forEach((idText, i) => {
    const productId = positiveId(idText);
    if (productId === null) return;
    const quantity = parseUnits(quantities[i] ?? "");
    const price = parseCents(prices[i] ?? "");
    const discountText = (discounts[i] ?? "").trim();
    const discount = discountText ? parseCents(discountText) : 0;
    if (quantity === null || quantity < 1) fields[`quantity-${productId}`] = t.sellAtLeastOne;
    else if (quantity > MAX_UNITS) fields[`quantity-${productId}`] = t.orderAtMost(MAX_UNITS);
    if (price === null) fields[`price-${productId}`] = t.enterPrice;
    if (discount === null) fields[`discount-${productId}`] = t.enterDiscount;
    lines.push({ productId, quantity: quantity ?? 0, unitPriceCents: price ?? 0, discountCents: discount ?? 0 });
    productIds.push(productId);
  });

  const saleDiscountText = field(formData, "saleDiscount").trim();
  const saleDiscount = saleDiscountText ? parseCents(saleDiscountText) : 0;
  if (saleDiscount === null) fields.discount = t.enterDiscount;
  const paid = parseCents(field(formData, "paid"));
  if (paid === null) fields.paid = t.enterPaid;
  const method = field(formData, "method") as PaymentMethod;
  if (!paymentMethods.includes(method)) fields.method = t.choosePayment;

  if (Object.keys(fields).length > 0) return { fields };
  if (lines.length === 0) return { error: { message: t.addProduct } };

  let id: number;
  try {
    ({ id } = await recordSale(db, user, {
      customerId,
      lines,
      discountCents: saleDiscount ?? 0,
      paidCents: paid ?? 0,
      method,
      note: field(formData, "note"),
    }));
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    // The domain names a line by its place; the form knows it by its product.
    const line = error.field?.match(/^(quantity|discount)-(\d+)$/);
    if (line) return { fields: { [`${line[1]}-${productIds[Number(line[2])]}`]: error.in(language) } };
    if (error.field === "discount" || error.field === "paid" || error.field === "customerId") {
      return { fields: { [error.field]: error.in(language) } };
    }
    return { error: { message: error.in(language) } };
  }
  redirect(`/sales/${id}`);
}

/** What the void button gets back. */
export type VoidFormState = FormState & { done?: { at: number } };

/** Voids a sale: admins only, checked by the domain. */
export async function voidSaleAction(_previous: VoidFormState, formData: FormData): Promise<VoidFormState> {
  const { db, user, language } = await authorize();
  const saleId = positiveId(field(formData, "saleId"));
  if (saleId === null) return { error: { message: ACTION_COPY[language].noSale } };
  try {
    await voidSale(db, user, saleId);
  } catch (error) {
    return formError(error, language);
  }
  refresh();
  return { done: { at: Date.now() } };
}
