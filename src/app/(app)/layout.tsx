import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/server/dal";
import { signOut } from "@/server/auth-actions";
import { getMoneyPrefs } from "@/server/preferences";
import { CurrencySwitch } from "@/components/currency-switch";
import { Nav } from "./nav";

/**
 * The app shell: a rail on the liner and one label sheet that every page prints onto.
 * The rail is static and prerendered; only the signed-in person streams in, so the
 * shell paints before the session is read.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        style={{ viewTransitionName: "app-rail" }}
        className="sticky top-0 hidden h-dvh flex-col px-4 pt-6 pb-4 lg:flex"
      >
        <Wordmark />
        <div className="mt-8">
          <Nav layout="rail" />
        </div>
        <div className="mt-auto">
          <Suspense fallback={<PersonFallback />}>
            <Person />
          </Suspense>
        </div>
      </aside>

      <div style={{ viewTransitionName: "app-bar" }} className="lg:hidden">
        <div className="flex items-center justify-between gap-4 px-3 pt-4 pb-3">
          <Wordmark />
          <Suspense fallback={null}>
            <PersonCompact />
          </Suspense>
        </div>
        <div className="px-3 pb-3">
          <Nav layout="strip" />
        </div>
      </div>

      <main className="lg:py-3 lg:pr-3">
        <div className="sheet min-h-[calc(100dvh-8rem)] rounded-none lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-label">
          {children}
        </div>
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <Link
      href="/dashboard"
      className="print-display inline-flex min-h-11 items-center px-3 text-2xl uppercase lg:min-h-0"
    >
      Stocktake
    </Link>
  );
}

/** On a phone: who is signed in, in which role, the currency, and the way out, in one line. */
async function PersonCompact() {
  const user = await getCurrentUser();
  const money = await getMoneyPrefs();
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <p className="min-w-0 truncate">
        <span className="font-semibold">{user.name}</span>
        <span className="text-ink-2"> · {user.role === "admin" ? "Admin" : "Staff"}</span>
      </p>
      <CurrencySwitch money={money} compact />
      <SignOutButton compact />
    </div>
  );
}

/** Who is signed in, the currency they read money in, and the way out. A name tag stuck to the liner. */
async function Person() {
  const user = await getCurrentUser();
  const money = await getMoneyPrefs();
  return (
    <div className="rounded-control bg-label px-3 pt-2.5 pb-1.5">
      <p className="truncate font-semibold">{user.name}</p>
      <p className="text-sm text-ink-2">{user.role === "admin" ? "Admin" : "Staff"}</p>
      <CurrencySwitch money={money} />
      <SignOutButton />
    </div>
  );
}

function PersonFallback() {
  return <div aria-hidden className="h-50 rounded-control bg-liner-deep" />;
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOut} className="shrink-0">
      <button
        type="submit"
        className={`-mx-1 min-h-11 px-1 text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink ${
          compact ? "" : "mt-1"
        }`}
      >
        Sign out
      </button>
    </form>
  );
}
