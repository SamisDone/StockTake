/**
 * The draft form's data, in a plain module so Server Components can build it: a
 * "use client" module's constants reach the server only as client references.
 */

/** A product the form can put on a line: what it is, what it costs, where a new line starts. */
export type ProductChoice = {
  id: number;
  sku: string;
  name: string;
  supplierId: number;
  onHand: number;
  unitCostCents: number;
  /** What the forecast says to order now; 0 when it says nothing. */
  suggested: number;
  /** Where a new line starts. */
  quantity: number;
};

/** One line as the form holds it: the product's facts, and its figures as typed. */
export type DraftLine = {
  productId: number;
  sku: string;
  name: string;
  /** The product's current unit cost, so a line priced differently can say so. */
  catalogCents: number;
  quantity: string;
  unitCost: string;
};

export type SupplierChoice = { id: number; name: string; leadTimeDays: number };

/** The draft as the form opens it. */
export type DraftValues = {
  supplierId: string;
  lines: DraftLine[];
  /** A date input's value, "2026-11-28", or "". */
  expectedAt: string;
  notes: string;
};

/** A day as a date input holds it, in UTC like every date on an order. */
export const dayInput = (date: Date) => date.toISOString().slice(0, 10);
