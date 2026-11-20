import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToProducts } from "../back-to-products";
import { ProductLabel, ProductLabelPlaceholder, productId } from "../product-label";

export const metadata: Metadata = { title: "Product" };

/** A product as its own page: what a shared link or a reload of an open drawer prints. */
export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <PageTransition>
      <Reveal fallback={<ProductLabelPlaceholder action={<BackToProducts />} />}>
        <Label params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  return <ProductLabel id={productId(id)} heading="h1" action={<BackToProducts />} />;
}
