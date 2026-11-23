import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { NAV_BACK } from "./transitions";

/** The way out of a record's label, or of a new one, back up to its list. */
export function BackLink({ href, label }: { href: Route; label: string }) {
  return (
    <Link
      href={href}
      transitionTypes={NAV_BACK}
      className="press-quiet -mt-3 -mr-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
      {label}
    </Link>
  );
}
