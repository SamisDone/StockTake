import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { EitherLanguage } from "@/components/either-language";
import { PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import { getLanguage } from "@/server/preferences";
import { SALES_COPY } from "../copy";
import { NewSale, NewSalePlaceholder } from "../new-sale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SALES_COPY[await getLanguage()].form.title };
}

/** Writing a sale with prices, from a blank label. `?customer=ID` arrives with that customer chosen. */
export default function NewSalePage({ searchParams }: PageProps<"/sales/new">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <NewSalePlaceholder
                language={language}
                action={<BackLink href="/sales" label={SALES_COPY[language].allSales} />}
              />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>
          {(language) => (
            <NewSale
              action={<BackLink href="/sales" label={SALES_COPY[language].allSales} />}
              searchParams={searchParams}
            />
          )}
        </WithLanguage>
      </Reveal>
    </PageTransition>
  );
}
