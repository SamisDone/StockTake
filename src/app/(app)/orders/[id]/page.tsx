import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToOrders } from "../back-to-orders";
import { OrderLabel, OrderLabelPlaceholder, orderId } from "../order-label";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d{1,9}$/.test(id) ? `PO-${id.padStart(4, "0")}` : "Purchase order" };
}

/** One purchase order, printed as its own label. */
export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <PageTransition>
      <Reveal fallback={<OrderLabelPlaceholder action={<BackToOrders />} />}>
        <Label params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;
  return <OrderLabel id={orderId(id)} action={<BackToOrders />} />;
}
