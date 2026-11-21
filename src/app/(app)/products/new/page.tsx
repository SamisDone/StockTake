import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToProducts } from "../back-to-products";
import { getLanguage } from "@/server/preferences";
import { PRODUCTS_COPY } from "../copy";
import { NewProduct, NewProductPlaceholder } from "../new-product";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: PRODUCTS_COPY[await getLanguage()].newTitle };
}

/** Adding a product as its own page: what a reload of the open drawer, or a shared link, prints. */
export default function NewProductPage() {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <NewProductPlaceholder language={language} action={<BackToProducts language={language} />} />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>
          {(language) => <NewProduct heading={1} action={<BackToProducts language={language} />} />}
        </WithLanguage>
      </Reveal>
    </PageTransition>
  );
}
