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
import { PersonMenu } from "./person-menu";
import { RailCommands } from "./commands";
import { MoreSheet, TabBar } from "./phone-bar";
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
          <Nav labels={t.nav} name={t.sections} />
        </div>
        <div className="mt-auto">
          <Suspense fallback={<PersonFallback />}>
            <Person language={language} />
          </Suspense>
        </div>
      </aside>

      {/* On a phone the top is just the mark and who's signed in; the sections, Record and
          the rest live in the tab bar at the foot. */}
      <div style={{ viewTransitionName: "app-bar" }} className="lg:hidden">
        <div className="flex items-center justify-between gap-4 px-3 pt-3 pb-2">
          <Wordmark compact />
          <Suspense fallback={null}>
            <PersonCompact language={language} />
          </Suspense>
        </div>
      </div>

      {/* On a phone the page ends clear of the tab bar at its foot. */}
      <main className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:py-3 lg:pr-3">
        <div className="sheet min-h-[calc(100dvh-8rem)] rounded-none lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-label">
          {children}
        </div>
      </main>
      {drawer}
      <TabBar language={language} />
      <MoreSheet language={language}>
        <Suspense fallback={null}>
          <PersonInMore language={language} />
        </Suspense>
      </MoreSheet>
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

/** On a phone: who is signed in, and in which role. The rest is under More. */
async function PersonCompact({ language }: { language: Language }) {
  const user = await getCurrentUser();
  return (
    <p className="min-w-0 truncate text-sm">
      <span className="font-semibold">{user.name}</span>
      <span className="text-ink-2"> · {ROLE_NAMES[language][user.role]}</span>
    </p>
  );
}

/** The foot of the phone's More sheet: the language, the currency, and the way out. */
async function PersonInMore({ language }: { language: Language }) {
  const money = await getMoneyPrefs();
  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      <LanguageSwitch language={language} variant="tag" />
      <CurrencySwitch money={money} language={language} />
      <SignOutButton language={language} />
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
    <PersonMenu name={user.name} role={ROLE_NAMES[language][user.role]} label={SHELL_COPY[language].settings}>
      <LanguageSwitch language={language} variant="tag" />
      <CurrencySwitch money={money} language={language} />
      <SignOutButton language={language} />
    </PersonMenu>
  );
}

function PersonFallback() {
  return <div aria-hidden className="h-16 rounded-control bg-liner-deep" />;
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
