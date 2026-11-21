import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NAV_BACK } from "@/components/transitions";

/** The way out of an order's label, or of a new one, back up to the list. */
export function BackToOrders() {
  return (
    <Link
      href="/orders"
      transitionTypes={NAV_BACK}
      className="press-quiet -mt-3 -mr-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={2.25} />
      All orders
    </Link>
  );
}
