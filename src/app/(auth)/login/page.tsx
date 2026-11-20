import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageTransition } from "@/components/transitions";
import { getSessionUser } from "@/server/dal";
import { HOME_PATH } from "@/server/session-cookie";
import { LoginLabel } from "./login-label";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <PageTransition>
        <LoginLabel />
      </PageTransition>
      <Suspense>
        <LeaveIfSignedIn />
      </Suspense>
    </main>
  );
}

/** Someone with a live session has no business here; the label itself stays static. */
async function LeaveIfSignedIn() {
  if (await getSessionUser()) redirect(HOME_PATH);
  return null;
}
