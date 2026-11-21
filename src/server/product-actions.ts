"use server";

import { refresh } from "next/cache";
import { DomainError, issueMessage } from "@/domain/errors";
import {
  type ProductInput,
  archiveProduct,
  createProduct,
  productInput,
  restoreProduct,
  updateProduct,
} from "@/domain/products";
import { parseCents, parseUnits } from "@/lib/parse";
import { authorize } from "./dal";
import { type FormState, field, formError } from "./form-state";
import { ACTION_COPY } from "./action-copy";

/** What the product form gets back: what's wrong with it, or the product it saved. */
export type ProductFormState = {
  /** A message per field at fault, keyed by the field's name in the form. */
  fields?: Record<string, string>;
  /** A problem with the entry as a whole. */
  error?: { message: string };
  values?: Record<string, string>;
  /** Set after a successful save. `at` changes on every save. */
  saved?: { id: number; at: number };
};

const FIELDS = [
  "name",
  "sku",
  "category",
  "supplierId",
  "unitCost",
  "unitPrice",
  "reorderPoint",
  "reorderQuantity",
  "description",
] as const;

/** The form types dollars; the domain stores cents. Every other field has the same name in both. */
const FORM_FIELD: Record<string, string> = { unitCostCents: "unitCost", unitPriceCents: "unitPrice" };
const formField = (domainField: string) => FORM_FIELD[domainField] ?? domainField;

/**
 * Adds a product, or edits one when the form carries its ID. Admin-only; the domain
 * checks. Everything wrong with what was typed comes back at once, each message next
 * to its field.
 */
export async function saveProduct(_previous: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];

  const values = Object.fromEntries(FIELDS.map((name) => [name, field(formData, name)])) as Record<
    (typeof FIELDS)[number],
    string
  >;
  const idText = field(formData, "productId");
  const productId = idText ? Number(idText) : null;
  if (productId !== null && !(Number.isInteger(productId) && productId > 0)) {
    return { error: { message: t.noProduct }, values };
  }

  const fields: Record<string, string> = {};
  const money = (name: "unitCost" | "unitPrice", what: "cost" | "price") => {
    const cents = parseCents(values[name]);
    if (cents === null) fields[name] = t.enterMoney(what);
    return cents ?? 0;
  };
  const units = (name: "reorderPoint" | "reorderQuantity") => {
    const n = parseUnits(values[name]);
    if (n === null) fields[name] = t.enterUnitsZero;
    return n ?? 0;
  };
  if (!values.sku.trim()) fields.sku = t.enterSku;
  const supplierId = values.supplierId ? Number(values.supplierId) : null;

  const input: ProductInput = {
    name: values.name,
    sku: values.sku,
    category: values.category,
    description: values.description,
    supplierId,
    unitCostCents: money("unitCost", "cost"),
    unitPriceCents: money("unitPrice", "price"),
    reorderPoint: units("reorderPoint"),
    reorderQuantity: units("reorderQuantity"),
  };
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      fields[formField(String(issue.path[0]))] ??= issueMessage(issue.message, language);
  }
  if (Object.keys(fields).length > 0) return { fields, values };

  let id: number;
  try {
    if (productId === null) {
      ({ id } = await createProduct(db, user, input));
    } else {
      await updateProduct(db, user, productId, input);
      id = productId;
    }
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return error.field
      ? { fields: { [formField(error.field)]: error.in(language) }, values }
      : { error: { message: error.in(language) }, values };
  }

  refresh();
  return { saved: { id, at: Date.now() } };
}

/** What the archive and restore forms get back. */
export type ArchiveFormState = FormState & {
  /** Set after a successful archive or restore. `at` changes every time. */
  done?: { archived: boolean; at: number };
};

/** Archives a product (`intent=archive`) or restores it (`intent=restore`). Admin-only. */
export async function setProductArchived(_previous: ArchiveFormState, formData: FormData): Promise<ArchiveFormState> {
  const { db, user, language } = await authorize();
  const productId = Number(field(formData, "productId"));
  const archive = field(formData, "intent") === "archive";
  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: { message: ACTION_COPY[language].noProduct } };
  }

  try {
    await (archive ? archiveProduct : restoreProduct)(db, user, productId);
  } catch (error) {
    return formError(error, language);
  }

  refresh();
  return { done: { archived: archive, at: Date.now() } };
}
