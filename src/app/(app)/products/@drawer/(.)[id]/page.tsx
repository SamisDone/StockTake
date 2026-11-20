import { Suspense, ViewTransition } from "react";
import { CloseSpace, Drawer } from "../../drawer";
import { ProductLabel, ProductLabelPlaceholder, productId } from "../../product-label";

/** A product opened from the list: its label slides in over the list, then prints as its data arrives. */
export default function ProductDrawer({ params }: PageProps<"/products/[id]">) {
  return (
    <Drawer>
      <Suspense
        fallback={
          <ViewTransition exit="tear" default="none">
            <ProductLabelPlaceholder action={<CloseSpace />} />
          </ViewTransition>
        }
      >
        <ViewTransition enter="print" default="none">
          <Label params={params} />
        </ViewTransition>
      </Suspense>
    </Drawer>
  );
}

async function Label({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  return <ProductLabel id={productId(id)} heading="h2" action={<CloseSpace />} />;
}
