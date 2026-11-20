/**
 * The product form's data, in a plain module so Server Components can build it: a
 * "use client" module's constants reach the server only as client references.
 */

/** A product's details as the form holds them: text, exactly as typed. */
export type ProductValues = {
  name: string;
  sku: string;
  category: string;
  supplierId: string;
  unitCost: string;
  unitPrice: string;
  reorderPoint: string;
  reorderQuantity: string;
  description: string;
};

export const EMPTY_PRODUCT: ProductValues = {
  name: "",
  sku: "",
  category: "",
  supplierId: "",
  unitCost: "",
  unitPrice: "",
  reorderPoint: "",
  reorderQuantity: "",
  description: "",
};

export type SupplierOption = { id: number; name: string; leadTimeDays: number };

/** What the archive zone needs to say what archiving will do. */
export type ArchiveFacts = { productId: number; name: string; onHand: number; valueCents: number };
