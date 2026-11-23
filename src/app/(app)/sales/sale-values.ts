/**
 * The sale form's data, in a plain module so Server Components can build it: a
 * "use client" module's constants reach the server only as client references.
 */

/** A product that can go on a sale: what it is, what's on the shelf, and its list price. */
export type SaleProduct = { id: number; sku: string; name: string; onHand: number; priceCents: number };

/** A customer the sale can be for, and what they owe already. */
export type CustomerChoice = { id: number; name: string; dueCents: number };
