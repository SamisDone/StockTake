import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { SupplierLabel, SupplierLabelPlaceholder, supplierId } from "../supplier-label";

// A fixed title: naming the supplier would read the database outside the session check.
export const metadata: Metadata = { title: "Supplier" };

/** One supplier, printed as its own label. */
export default function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  return (
    <PageTransition>
      <Reveal fallback={<SupplierLabelPlaceholder action={<BackToSuppliers />} />}>
        <Label params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params }: { params: PageProps<"/suppliers/[id]">["params"] }) {
  const { id } = await params;
  return <SupplierLabel id={supplierId(id)} action={<BackToSuppliers />} />;
}
