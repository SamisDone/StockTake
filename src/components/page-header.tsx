import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";
import { EitherLanguage } from "./either-language";

/**
 * The label's header zone: the page title printed large, closed by a 2px rule. The title
 * comes in both languages, so the header prints with the prefetched page.
 */
export function PageHeader({ title, actions }: { title: Record<Language, string>; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
      <h1 className="print-display text-4xl text-balance sm:text-5xl">
        <EitherLanguage inline>{(language) => title[language]}</EitherLanguage>
      </h1>
      {actions}
    </header>
  );
}
