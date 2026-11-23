import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import type { Language } from "@/lib/i18n";
import { getLanguage } from "@/server/preferences";
import { recordName } from "@/server/titles";
import { CUSTOMERS_COPY } from "../copy";
import { CustomerLabel, CustomerLabelPlaceholder, customerId } from "../customer-label";

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await recordName("customer", id)) ?? CUSTOMERS_COPY[await getLanguage()].customerTitle };
}

/** One customer, printed as their own label. */
export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <CustomerLabelPlaceholder
            action={(language) => <BackLink href="/customers" label={CUSTOMERS_COPY[language].allCustomers} />}
          />
        }
      >
        <WithLanguage>{(language) => <Label params={params} language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/customers/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return (
    <CustomerLabel
      id={customerId(id)}
      action={<BackLink href="/customers" label={CUSTOMERS_COPY[language].allCustomers} />}
    />
  );
}
