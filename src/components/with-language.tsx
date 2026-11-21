import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";
import { getLanguage } from "@/server/preferences";

/**
 * Reads the reader's language where it's needed, inside a page's loading boundary,
 * so the page's frame (title, placeholders) never waits on the request to print.
 */
export async function WithLanguage({ children }: { children: (language: Language) => ReactNode }) {
  return children(await getLanguage());
}
