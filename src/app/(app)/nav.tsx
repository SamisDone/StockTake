"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Suspense } from "react";
import type { NavLabels } from "./copy";

/** The app's sections, in order. Each one joins this list when its page is built. */
export const SECTIONS: (keyof NavLabels & Route)[] = [
  "/dashboard",
  "/ask",
  "/products",
  "/orders",
  "/suppliers",
  "/analytics",
  "/activity",
  "/people",
];

type Props = { labels: NavLabels; name: string };

/**
 * Section links. The current one is reverse-printed, the way a label marks what matters.
 * It follows the page in the sheet, not the address: a product opened in the drawer
 * over the dashboard has a product's address, but the dashboard is still where you are.
 * Under a page with a dynamic param (a product) the segment is only known at request
 * time, so the links prerender unmarked and the mark arrives with the request. This is
 * the rail's; on a phone the tab bar and the More sheet take its place.
 */
export function Nav(props: Props) {
  return (
    <Suspense fallback={<NavLinks {...props} section={null} />}>
      <CurrentNav {...props} />
    </Suspense>
  );
}

function CurrentNav(props: Props) {
  // The sheet's top segment; the drawer is a slot of its own.
  return <NavLinks {...props} section={useSection()} />;
}

/** The current section, from the sheet's top segment ("dashboard", "products"…). */
export function useSection() {
  const segment = useSelectedLayoutSegment();
  return segment === null ? null : `/${segment}`;
}

function NavLinks({ labels, name, section }: Props & { section: string | null }) {
  return (
    <nav aria-label={name}>
      <ul className="flex flex-col gap-0.5">
        {SECTIONS.map((href) => {
          const current = section === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-control px-3 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-150 ${
                  current ? "bg-ink text-label" : "text-ink-2 hover:bg-liner-deep hover:text-ink"
                }`}
              >
                {labels[href]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
