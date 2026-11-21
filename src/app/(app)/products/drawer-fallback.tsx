"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * What the drawer shows while the request is read: the shape of a product's label, or
 * of a blank one for /products/new. The segment comes from the URL the router already
 * has, so the right one is there the moment the drawer opens.
 */
export function DrawerFallback({ product, blank }: { product: ReactNode; blank: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return id === "new" ? blank : product;
}
