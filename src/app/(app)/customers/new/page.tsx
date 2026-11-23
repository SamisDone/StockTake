import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import type { Language } from "@/lib/i18n";
import { getCurrentUser } from "@/server/dal";
import { getLanguage } from "@/server/preferences";
import { CUSTOMERS_COPY } from "../copy";
import { CustomerForm, EMPTY_CUSTOMER } from "../customer-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CUSTOMERS_COPY[await getLanguage()].form.newTitle };
}

/** Adding a customer, from a blank label. Anyone can; the new customer opens on their own label. */
export default function NewCustomerPage() {
  return (
    <PageTransition>
      <Reveal fallback={<div aria-hidden className="h-96" />}>
        <WithLanguage>{(language) => <NewCustomer language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function NewCustomer({ language }: { language: Language }) {
  await getCurrentUser();
  return (
    <CustomerForm
      language={language}
      defaults={EMPTY_CUSTOMER}
      action={<BackLink href="/customers" label={CUSTOMERS_COPY[language].allCustomers} />}
    />
  );
}
