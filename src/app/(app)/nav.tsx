"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { NavLabels } from "./copy";

/** The app's sections, in order. Each one joins this list when its page is built. */
const SECTIONS: (keyof NavLabels & Route)[] = [
  "/dashboard",
  "/ask",
  "/products",
  "/orders",
  "/suppliers",
  "/analytics",
  "/activity",
];

type Props = { layout: "rail" | "strip"; labels: NavLabels; name: string };

/**
 * Section links. The current one is reverse-printed, the way a label marks what matters.
 * Under a page with a dynamic param (a product) the path is only known at request time,
 * so the links prerender unmarked and the mark arrives with the request.
 */
export function Nav(props: Props) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <CurrentNav {...props} />
    </Suspense>
  );
}

function CurrentNav(props: Props) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ layout, labels, name, pathname }: Props & { pathname: string | null }) {
  return (
    <nav aria-label={name}>
      <ul className={layout === "rail" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto"}>
        {SECTIONS.map((href) => {
          const current = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
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
