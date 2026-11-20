"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The app's sections. Each one joins this list when its page is built. */
const SECTIONS: { href: Route; label: string }[] = [{ href: "/dashboard", label: "Dashboard" }];

/** Section links. The current one is reverse-printed, the way a label marks what matters. */
export function Nav({ layout }: { layout: "rail" | "strip" }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections">
      <ul className={layout === "rail" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto"}>
        {SECTIONS.map(({ href, label }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
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
