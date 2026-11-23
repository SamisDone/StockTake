import { Download } from "lucide-react";
import { COMPONENT_COPY } from "./copy";
import { EitherLanguage } from "./either-language";

/**
 * A table taken out as a CSV file. A plain link, never prefetched: the file is written
 * on the server when it's asked for, and the browser saves it rather than leaving the
 * page. It reads nothing from the request, so it prints with the page's frame.
 */
export function ExportLink({ href, label }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      download
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink"
    >
      <Download aria-hidden size={18} strokeWidth={2.25} />
      {/* On a phone the header keeps one line: the icon stays, the words go to screen readers. */}
      <span className="max-sm:sr-only">
        {label ?? <EitherLanguage inline>{(language) => COMPONENT_COPY[language].exportCsv}</EitherLanguage>}
      </span>
    </a>
  );
}
