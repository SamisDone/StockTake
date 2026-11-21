import { Suspense, ViewTransition } from "react";
import { CloseSpace } from "../../../drawer";
import { NewProduct, NewProductPlaceholder } from "../../../new-product";
import { ProductLabel, ProductLabelPlaceholder, productId } from "../../../product-label";
import { getLanguage } from "@/server/preferences";

/**
 * What opens over the list: a product's label, sliding in and printing as its data
 * arrives, or, for /products/new, a blank label to fill in. Both live in this one
 * intercept: a static `(.)new` beside it in a route group isn't matched (Next.js
 * 16.4), and the dynamic segment caught "new" instead.
 */
export default function ProductDrawer({ params }: PageProps<"/products/[id]">) {
  // The segment is request data, so it's read inside a boundary; it resolves at once.
  return (
    <Suspense>
      <Opened params={params} />
    </Suspense>
  );
}

async function Opened({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  const language = await getLanguage();
  if (id === "new") {
    return (
      <ViewTransition exit="tear" default="none">
        <Suspense fallback={<NewProductPlaceholder language={language} action={<CloseSpace />} />}>
          <NewProduct heading={2} action={<CloseSpace />} />
        </Suspense>
      </ViewTransition>
    );
  }

  return (
    <Suspense
      fallback={
        <ViewTransition exit="tear" default="none">
          <ProductLabelPlaceholder language={language} action={<CloseSpace />} />
        </ViewTransition>
      }
    >
      <ViewTransition enter="print" default="none">
        <ProductLabel id={productId(id)} heading="h2" action={<CloseSpace />} />
      </ViewTransition>
    </Suspense>
  );
}
