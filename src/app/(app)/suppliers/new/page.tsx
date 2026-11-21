import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { getLanguage } from "@/server/preferences";
import { SUPPLIERS_COPY } from "../copy";
import { NewSupplier, NewSupplierPlaceholder } from "../new-supplier";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SUPPLIERS_COPY[await getLanguage()].newTitle };
}

/** Adding a supplier, from a blank label. */
export default async function NewSupplierPage() {
  const language = await getLanguage();
  return (
    <PageTransition>
      <Reveal
        fallback={<NewSupplierPlaceholder language={language} action={<BackToSuppliers language={language} />} />}
      >
        <NewSupplier action={<BackToSuppliers language={language} />} />
      </Reveal>
    </PageTransition>
  );
}
