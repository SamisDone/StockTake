import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { getLanguage } from "@/server/preferences";
import type { Language } from "@/lib/i18n";
import { SUPPLIERS_COPY } from "../copy";
import { SupplierLabel, SupplierLabelPlaceholder, supplierId } from "../supplier-label";
import { EitherLanguage } from "@/components/either-language";
import { WithLanguage } from "@/components/with-language";

// A fixed title: naming the supplier would read the database outside the session check.
export async function generateMetadata(): Promise<Metadata> {
  return { title: SUPPLIERS_COPY[await getLanguage()].supplierTitle };
}

/** One supplier, printed as its own label. */
export default function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <EitherLanguage>
            {(language) => (
              <SupplierLabelPlaceholder language={language} action={<BackToSuppliers language={language} />} />
            )}
          </EitherLanguage>
        }
      >
        <WithLanguage>{(language) => <Label params={params} language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/suppliers/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return <SupplierLabel id={supplierId(id)} action={<BackToSuppliers language={language} />} />;
}
