import Link from "next/link";
import type { Route } from "next";
import { type Copy, LANGUAGE_TAGS, type Language } from "@/lib/i18n";

const COPY: Copy<{ title: string; body: string; dashboard: string; products: string; home: string }> = {
  en: {
    title: "Nothing here",
    body: "This page doesn't exist. The link may be mistyped, or the record it pointed to was never made.",
    dashboard: "Go to the dashboard",
    products: "See every product",
    home: "Back to the start",
  },
  bn: {
    title: "এখানে কিছু নেই",
    body: "এই পাতাটি নেই। লিংকটি হয়তো ভুল লেখা, অথবা যে রেকর্ডের দিকে নির্দেশ করছিল সেটি কখনো তৈরিই হয়নি।",
    dashboard: "ড্যাশবোর্ডে যান",
    products: "সব পণ্য দেখুন",
    home: "শুরুতে ফিরুন",
  },
};

const LINK =
  "font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink";

/**
 * What a missing page prints: inside the app, a label in the sheet with the way back
 * into it; outside, the same words on a label of its own.
 */
export function NotFoundLabel({ language, inApp }: { language: Language; inApp: boolean }) {
  const t = COPY[language];
  return (
    <div lang={LANGUAGE_TAGS[language]}>
      <header className="border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <h1 className="print-display text-4xl text-balance sm:text-5xl">{t.title}</h1>
      </header>
      <div className="px-5 pt-5 pb-8 sm:px-8">
        <p className="max-w-prose text-ink-2">{t.body}</p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <li className="flex min-h-11 items-center">
            <Link href={(inApp ? "/dashboard" : "/") as Route} className={LINK}>
              {inApp ? t.dashboard : t.home}
            </Link>
          </li>
          {inApp ? (
            <li className="flex min-h-11 items-center">
              <Link href="/products" className={LINK}>
                {t.products}
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
