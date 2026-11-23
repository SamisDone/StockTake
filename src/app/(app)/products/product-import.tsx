import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/dal";
import { getLanguage } from "@/server/preferences";
import type { Language } from "@/lib/i18n";
import { PRODUCTS_COPY } from "./copy";
import { IMPORT_COPY } from "./import-copy";
import { ImportForm } from "./import-form";

/**
 * Importing products from a CSV file, opened over the list like a new product, or as
 * its own page. The catalog is an admin's, so anyone else is told so plainly.
 */
export async function ProductImport({ heading, action }: { heading: 1 | 2; action: ReactNode }) {
  const user = await getCurrentUser();
  const language = await getLanguage();
  const t = IMPORT_COPY[language];
  const Title = heading === 1 ? "h1" : "h2";
  const title = (
    <Title id="product-title" className="print-display text-4xl text-balance sm:text-5xl">
      {t.title}
    </Title>
  );

  if (user.role !== "admin") {
    return (
      <div>
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
          {title}
          {action}
        </header>
        <p className="max-w-prose px-5 py-5 text-ink-2 sm:px-8">{PRODUCTS_COPY[language].adminOnly}</p>
      </div>
    );
  }

  return <ImportForm language={language} heading={title} action={action} />;
}

/** The import label, unprinted: its header, its intro and the file field hold their space. */
export function ProductImportPlaceholder({ language, action }: { language: Language; action?: ReactNode }) {
  const t = IMPORT_COPY[language];
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <p className="print-display text-4xl sm:text-5xl">{t.title}</p>
          <div className="mt-3 h-4 w-11/12 bg-liner/70" />
          <div className="mt-2 h-4 w-3/4 bg-liner/70" />
        </div>
        {action}
      </div>
      <div className="border-b-2 border-ink px-5 pt-2.5 pb-4 sm:px-8">
        <p className="field-name">{t.file}</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="h-6 w-40 bg-liner/70" />
          <div className="h-12 w-44 rounded-control bg-liner" />
        </div>
        <div className="mt-2 h-3 w-4/5 bg-liner/70" />
      </div>
    </div>
  );
}
