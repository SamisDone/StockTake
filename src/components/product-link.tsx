import type { ReactNode } from "react";
import { IntentLink } from "./intent-link";

/**
 * A link to a product. Anywhere in the app it opens the product in the drawer, over the
 * page it was clicked on, so the page beneath keeps its scroll and doesn't slide away;
 * the address itself, loaded in full, prints the product as a page.
 */
export function ProductLink({ id, className, children }: { id: number; className?: string; children: ReactNode }) {
  return (
    <IntentLink href={`/products/${id}`} scroll={false} className={className}>
      {children}
    </IntentLink>
  );
}
