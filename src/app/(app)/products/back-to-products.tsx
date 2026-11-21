import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NAV_BACK } from "@/components/transitions";
import type { Language } from "@/lib/i18n";
import { PRODUCTS_COPY } from "./copy";

/** The way back to the list from a product printed as its own page. */
export function BackToProducts({ language }: { language: Language }) {
  return (
    <Link
      href="/products"
      transitionTypes={NAV_BACK}
      className="-mt-3 -mr-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink"
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
      {PRODUCTS_COPY[language].allProducts}
    </Link>
  );
}
