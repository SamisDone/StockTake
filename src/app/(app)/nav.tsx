"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

/** The app's sections. Each one joins this list when its page is built. */
const SECTIONS: { href: Route; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
];

/**
 * Section links. The current one is reverse-printed, the way a label marks what matters.
 * Under a page with a dynamic param (a product) the path is only known at request time,
 * so the links prerender unmarked and the mark arrives with the request.
 */
export function Nav({ layout }: { layout: "rail" | "strip" }) {
  return (
    <Suspense fallback={<NavLinks layout={layout} pathname={null} />}>
      <CurrentNav layout={layout} />
    </Suspense>
  );
}

function CurrentNav({ layout }: { layout: "rail" | "strip" }) {
  return <NavLinks layout={layout} pathname={usePathname()} />;
}

function NavLinks({ layout, pathname }: { layout: "rail" | "strip"; pathname: string | null }) {
  return (
    <nav aria-label="Sections">
      <ul className={layout === "rail" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto"}>
        {SECTIONS.map(({ href, label }) => {
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
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
