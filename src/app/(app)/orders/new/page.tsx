import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToOrders } from "../back-to-orders";
import { getLanguage } from "@/server/preferences";
import { ORDERS_COPY } from "../copy";
import { NewOrder, NewOrderPlaceholder } from "../new-order";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: ORDERS_COPY[await getLanguage()].newTitle };
}

/**
 * Writing an order by hand, from a blank label. Drafting from the forecast is on the
 * list. `?supplier=ID` (a supplier's label links here) arrives with it chosen.
 */
export default function NewOrderPage({ searchParams }: PageProps<"/orders/new">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => <NewOrderPlaceholder language={language} action={<BackToOrders language={language} />} />}
          </EitherLanguage>
        }
      >
        <WithLanguage>
          {(language) => <NewOrder action={<BackToOrders language={language} />} searchParams={searchParams} />}
        </WithLanguage>
      </Reveal>
    </PageTransition>
  );
}
