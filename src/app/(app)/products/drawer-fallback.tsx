"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * What the drawer shows while the request is read: the shape of a product's label, of
 * a blank one for /products/new, or of the import for /products/import. The segment
 * comes from the URL the router already has, so the right one is there the moment the
 * drawer opens.
 */
export function DrawerFallback({
  product,
  blank,
  importing,
}: {
  product: ReactNode;
  blank: ReactNode;
  importing: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  return id === "new" ? blank : id === "import" ? importing : product;
}
