import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToOrders } from "../back-to-orders";
import { NewOrder, NewOrderPlaceholder } from "../new-order";

export const metadata: Metadata = { title: "New order" };

/**
 * Writing an order by hand, from a blank label. Drafting from the forecast is on the
 * list. `?supplier=ID` (a supplier's label links here) arrives with it chosen.
 */
export default function NewOrderPage({ searchParams }: PageProps<"/orders/new">) {
  return (
    <PageTransition>
      <Reveal fallback={<NewOrderPlaceholder action={<BackToOrders />} />}>
        <NewOrder action={<BackToOrders />} searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}
