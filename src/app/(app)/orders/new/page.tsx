import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToOrders } from "../back-to-orders";
import { NewOrder, NewOrderPlaceholder } from "../new-order";

export const metadata: Metadata = { title: "New order" };

/** Writing an order by hand, from a blank label. Drafting from the forecast is on the list. */
export default function NewOrderPage() {
  return (
    <PageTransition>
      <Reveal fallback={<NewOrderPlaceholder action={<BackToOrders />} />}>
        <NewOrder action={<BackToOrders />} />
      </Reveal>
    </PageTransition>
  );
}
