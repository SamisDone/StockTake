import type { Metadata } from "next";
import { PageTransition, Reveal } from "@/components/transitions";
import { BackToSuppliers } from "../back-to-suppliers";
import { NewSupplier, NewSupplierPlaceholder } from "../new-supplier";

export const metadata: Metadata = { title: "New supplier" };

/** Adding a supplier, from a blank label. */
export default function NewSupplierPage() {
  return (
    <PageTransition>
      <Reveal fallback={<NewSupplierPlaceholder action={<BackToSuppliers />} />}>
        <NewSupplier action={<BackToSuppliers />} />
      </Reveal>
    </PageTransition>
  );
}
