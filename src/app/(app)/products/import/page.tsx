import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToProducts } from "../back-to-products";
import { getLanguage } from "@/server/preferences";
import { IMPORT_COPY } from "../import-copy";
import { ProductImport, ProductImportPlaceholder } from "../product-import";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: IMPORT_COPY[await getLanguage()].title };
}

/** Importing products as its own page: what a reload of the open drawer, or a shared link, prints. */
export default function ImportProductsPage() {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <ProductImportPlaceholder language={language} action={<BackToProducts language={language} />} />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>
          {(language) => <ProductImport heading={1} action={<BackToProducts language={language} />} />}
        </WithLanguage>
      </Reveal>
    </PageTransition>
  );
}
