import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { getLanguage } from "@/server/preferences";
import type { Language } from "@/lib/i18n";
import { SUPPLIERS_COPY } from "../copy";
import { SupplierLabel, SupplierLabelPlaceholder, supplierId } from "../supplier-label";

// A fixed title: naming the supplier would read the database outside the session check.
export async function generateMetadata(): Promise<Metadata> {
  return { title: SUPPLIERS_COPY[await getLanguage()].supplierTitle };
}

/** One supplier, printed as its own label. */
export default async function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  const language = await getLanguage();
  return (
    <PageTransition>
      <Reveal
        fallback={<SupplierLabelPlaceholder language={language} action={<BackToSuppliers language={language} />} />}
      >
        <Label params={params} language={language} />
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/suppliers/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return <SupplierLabel id={supplierId(id)} action={<BackToSuppliers language={language} />} />;
}
