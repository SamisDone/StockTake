import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NAV_BACK, PageTransition, Reveal } from "@/components/transitions";
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

function BackToProducts() {
  return (
    <Link
      href="/products"
      transitionTypes={NAV_BACK}
      className="-mt-2 -mr-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:bg-liner hover:text-ink sm:-mt-3"
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
      All products
    </Link>
  );
}
