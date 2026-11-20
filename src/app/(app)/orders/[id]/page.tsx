import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NAV_BACK, PageTransition, Reveal } from "@/components/transitions";
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

function BackToOrders() {
  return (
    <Link
      href="/orders"
      transitionTypes={NAV_BACK}
      className="press-quiet -mt-3 -mr-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
      All orders
    </Link>
  );
}
