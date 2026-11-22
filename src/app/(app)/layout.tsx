import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/server/dal";
import { signOut } from "@/server/auth-actions";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import { CurrencySwitch } from "@/components/currency-switch";
import { LanguageSwitch } from "@/components/language-switch";
import { Mark } from "@/components/logo";
import { NavProgress } from "@/components/nav-progress";
import { Toaster } from "@/components/toasts";
import { ROLE_NAMES } from "@/lib/demo-roles";
import { LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { SHELL_COPY } from "./copy";
import { Nav } from "./nav";
import { PhoneRecord, RailCommands } from "./commands";
import { Palette } from "./palette";
import { RecordSheet } from "./record-sheet";

/**
 * The app shell: a rail on the liner and one label sheet that every page prints onto.
 * The shell is printed in the reader's language, which is only a cookie, so it streams
 * at once; the signed-in person streams in after the session is read. Layouts persist
 * between pages, so this happens on a full load only.
 */
export default function AppLayout({ children, drawer }: LayoutProps<"/"> & { drawer: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Shell drawer={drawer}>{children}</Shell>
    </Suspense>
  );
}

/**
 * `drawer` is a product opened over whatever page linked to it: a link to
 * /products/[id] from anywhere in the app is intercepted into it, so the same click
 * always opens the same drawer. Loading the URL itself prints the product as a page.
 */
async function Shell({ children, drawer }: { children: ReactNode; drawer: ReactNode }) {
  const language = await getLanguage();
  const t = SHELL_COPY[language];
  return (
    <div lang={LANGUAGE_TAGS[language]} className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        style={{ viewTransitionName: "app-rail" }}
        className="sticky top-0 hidden h-dvh flex-col px-4 pt-6 pb-4 lg:flex"
      >
        <Wordmark />
        <div className="mt-6">
          <RailCommands language={language} />
        </div>
        <div className="mt-6">
          <Nav layout="rail" labels={t.nav} name={t.sections} />
        </div>
        <div className="mt-auto">
          <Suspense fallback={<PersonFallback />}>
            <Person language={language} />
          </Suspense>
        </div>
      </aside>

      <div style={{ viewTransitionName: "app-bar" }} className="lg:hidden">
        <div className="flex items-center justify-between gap-4 px-3 pt-4 pb-3">
          <Wordmark compact />
          <Suspense fallback={null}>
            <PersonCompact language={language} />
          </Suspense>
        </div>
        <div className="px-3 pb-3">
          <Nav layout="strip" labels={t.nav} name={t.sections} />
        </div>
      </div>

      <main className="lg:py-3 lg:pr-3">
        <div className="sheet min-h-[calc(100dvh-8rem)] rounded-none lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-label">
          {children}
        </div>
      </main>
      {drawer}
      <PhoneRecord language={language} />
      <RecordSheet language={language} />
      <Suspense fallback={null}>
        <PaletteFor language={language} />
      </Suspense>
      <Toaster language={language} />
      {/* It reads the address, which a layout can only do inside a boundary. */}
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
    </div>
  );
}

/**
 * The mark and the name. On a phone the bar also carries the person, the currency, the
 * language and the way out, so the mark stands alone there and the name is left to
 * screen readers.
 */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      lang="en"
      className={`print-display inline-flex min-h-11 shrink-0 items-center gap-2.5 text-2xl uppercase lg:min-h-0 ${compact ? "min-w-11" : "px-3"}`}
    >
      <Mark size={32} />
      <span className={compact ? "sr-only" : undefined}>Stocktake</span>
    </Link>
  );
}

/** The palette offers admin actions to admins and the other currency, so it waits for the person. */
async function PaletteFor({ language }: { language: Language }) {
  const user = await getCurrentUser();
  const money = await getMoneyPrefs();
  return <Palette language={language} currency={money.currency} isAdmin={user.role === "admin"} />;
}

/** On a phone: who is signed in, in which role, the currency, the language, and the way out, in one line. */
async function PersonCompact({ language }: { language: Language }) {
  const user = await getCurrentUser();
  const money = await getMoneyPrefs();
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <p className="min-w-0 truncate">
        <span className="font-semibold">{user.name}</span>
        <span className="text-ink-2"> · {ROLE_NAMES[language][user.role]}</span>
      </p>
      <CurrencySwitch money={money} language={language} compact />
      <LanguageSwitch language={language} variant="toggle" short />
      <SignOutButton language={language} compact />
    </div>
  );
}

/**
 * Who is signed in, the language and currency they read in, and the way out. A name tag
 * stuck to the liner. The currency comes last: its rate line holds its height when empty,
 * so the gap it leaves in dollars sits at the foot, not between the fields.
 */
async function Person({ language }: { language: Language }) {
  const user = await getCurrentUser();
  const money = await getMoneyPrefs();
  return (
    <div className="rounded-control bg-label px-3 pt-2.5 pb-1.5">
      <p className="truncate font-semibold">{user.name}</p>
      <p className="text-sm text-ink-2">{ROLE_NAMES[language][user.role]}</p>
      <LanguageSwitch language={language} variant="tag" />
      <CurrencySwitch money={money} language={language} />
      <SignOutButton language={language} />
    </div>
  );
}

function PersonFallback() {
  return <div aria-hidden className="h-68 rounded-control bg-liner-deep" />;
}

function SignOutButton({ language, compact = false }: { language: Language; compact?: boolean }) {
  return (
    <form action={signOut} className="shrink-0">
      <button
        type="submit"
        className={`-mx-1 min-h-11 px-1 text-sm font-semibold whitespace-nowrap underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink ${
          compact ? "" : "mt-1"
        }`}
      >
        {SHELL_COPY[language].signOut}
      </button>
    </form>
  );
}
