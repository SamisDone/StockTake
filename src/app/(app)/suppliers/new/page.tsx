import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { getLanguage } from "@/server/preferences";
import { SUPPLIERS_COPY } from "../copy";
import { NewSupplier, NewSupplierPlaceholder } from "../new-supplier";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SUPPLIERS_COPY[await getLanguage()].newTitle };
}

/** Adding a supplier, from a blank label. */
export default function NewSupplierPage() {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <NewSupplierPlaceholder language={language} action={<BackToSuppliers language={language} />} />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>{(language) => <NewSupplier action={<BackToSuppliers language={language} />} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}
