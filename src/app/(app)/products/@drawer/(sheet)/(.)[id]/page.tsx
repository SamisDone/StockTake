import { Suspense } from "react";
import { CloseSpace } from "../../../drawer";
import { NewProduct, NewProductPlaceholder } from "../../../new-product";
import { ProductLabel, ProductLabelPlaceholder, productId } from "../../../product-label";
import { getLanguage } from "@/server/preferences";
import { EitherLanguage } from "@/components/either-language";
import { DrawerFallback } from "../../../drawer-fallback";
import { recordName } from "@/server/titles";
import type { Metadata } from "next";
import { PRODUCTS_COPY } from "../../../copy";

/**
 * What opens over the list: a product's label, sliding in and printing as its data
 * arrives, or, for /products/new, a blank label to fill in. Both live in this one
 * intercept: a static `(.)new` beside it in a route group isn't matched (Next.js
 * 16.4), and the dynamic segment caught "new" instead.
 */
export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = PRODUCTS_COPY[await getLanguage()];
  if (id === "new") return { title: t.newTitle };
  return { title: (await recordName("product", id)) ?? t.productTitle };
}

export default function ProductDrawer({ params }: PageProps<"/products/[id]">) {
  // The segment and the language are request data, so they're read inside a boundary.
  // Its placeholder is chosen from the URL on the client and printed in both languages,
  // so the drawer opens with it at once rather than after a round trip.
  return (
    <Suspense
      fallback={
        <DrawerFallback
          product={
            <EitherLanguage>
              {(language) => <ProductLabelPlaceholder language={language} action={<CloseSpace />} />}
            </EitherLanguage>
          }
          blank={
            <EitherLanguage>
              {(language) => <NewProductPlaceholder language={language} action={<CloseSpace />} />}
            </EitherLanguage>
          }
        />
      }
    >
      <Opened params={params} />
    </Suspense>
  );
}

/**
 * The drawer prints its label with a CSS animation, not a view transition: a view
 * transition captures every named part of the list beneath, and those snapshots are
 * painted above the dialog's top layer for the whole animation.
 */
async function Opened({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  const language = await getLanguage();
  if (id === "new") {
    return (
      <Suspense fallback={<NewProductPlaceholder language={language} action={<CloseSpace />} />}>
        <NewProduct heading={2} action={<CloseSpace />} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ProductLabelPlaceholder language={language} action={<CloseSpace />} />}>
      <div className="print-in">
        <ProductLabel id={productId(id)} heading="h2" action={<CloseSpace />} />
      </div>
    </Suspense>
  );
}
