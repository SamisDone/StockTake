import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import { saleNumber } from "@/domain/sales";
import type { Language } from "@/lib/i18n";
import { getLanguage } from "@/server/preferences";
import { SALES_COPY } from "../copy";
import { SaleLabel, SaleLabelPlaceholder, saleId } from "../sale-label";

export async function generateMetadata({ params }: PageProps<"/sales/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d{1,9}$/.test(id) ? saleNumber(Number(id)) : SALES_COPY[await getLanguage()].saleTitle };
}

/** One sale, printed as its own label. */
export default function SalePage({ params }: PageProps<"/sales/[id]">) {
  return (
    <PageTransition>
      <Reveal
        fallback={
          <SaleLabelPlaceholder
            action={(language) => <BackLink href="/sales" label={SALES_COPY[language].allSales} />}
          />
        }
      >
        <WithLanguage>{(language) => <Label params={params} language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

async function Label({ params, language }: { params: PageProps<"/sales/[id]">["params"]; language: Language }) {
  const { id } = await params;
  return <SaleLabel id={saleId(id)} action={<BackLink href="/sales" label={SALES_COPY[language].allSales} />} />;
}
