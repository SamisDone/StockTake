import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToProducts } from "../back-to-products";
import { NewProduct, NewProductPlaceholder } from "../new-product";

export const metadata: Metadata = { title: "New product" };

/** Adding a product as its own page: what a reload of the open drawer, or a shared link, prints. */
export default function NewProductPage() {
  return (
    <PageTransition>
      <Reveal fallback={<NewProductPlaceholder action={<BackToProducts />} />}>
        <NewProduct heading={1} action={<BackToProducts />} />
      </Reveal>
    </PageTransition>
  );
}
