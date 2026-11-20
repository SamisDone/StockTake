import type { ReactNode } from "react";

/**
 * Products and the drawer slot. Opening a product from the list intercepts its route
 * into the drawer, over the list, with the product's own URL; loading that URL directly
 * prints the product as a full page instead.
 */
export default function ProductsLayout({ children, drawer }: { children: ReactNode; drawer: ReactNode }) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
