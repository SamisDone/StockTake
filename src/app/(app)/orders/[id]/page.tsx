import type { Metadata } from "next";
import type { Language } from "@/lib/i18n";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToOrders } from "../back-to-orders";
import { getLanguage } from "@/server/preferences";
import { ORDERS_COPY } from "../copy";
import { OrderLabel, OrderLabelPlaceholder, orderId } from "../order-label";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d{1,9}$/.test(id) ? `PO-${id.padStart(4, "0")}` : ORDERS_COPY[await getLanguage()].orderTitle };
}

/** One purchase order, printed as its own label. */
export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const language = await getLanguage();
  return (
    <PageTransition>
      <Reveal fallback={<OrderLabelPlaceholder language={language} action={<BackToOrders language={language} />} />}>
        <Label params={params} language={language} />
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/orders/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return <OrderLabel id={orderId(id)} action={<BackToOrders language={language} />} />;
}
