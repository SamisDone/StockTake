import type { Metadata } from "next";
import type { Language } from "@/lib/i18n";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToProducts } from "../back-to-products";
import { getLanguage } from "@/server/preferences";
import { PRODUCTS_COPY } from "../copy";
import { ProductLabel, ProductLabelPlaceholder, productId } from "../product-label";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: PRODUCTS_COPY[await getLanguage()].productTitle };
}

/** A product as its own page: what a shared link or a reload of an open drawer prints. */
export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <ProductLabelPlaceholder language={language} action={<BackToProducts language={language} />} />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>{(language) => <Label params={params} language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/products/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return <ProductLabel id={productId(id)} heading="h1" action={<BackToProducts language={language} />} />;
}
