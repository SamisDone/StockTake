import type { Metadata } from "next";
import { PageTransition } from "@/components/transitions";
import { LOGIN_TITLE, LoginLabel } from "./login-label";

export const metadata: Metadata = { title: LOGIN_TITLE.en };

/**
 * Fully static: nothing here reads the request, so the page is served as a prerendered
 * file and costs almost no CPU on the free plan. A signed-in visitor simply sees the form.
 * Its Bangla twin is /bn/login; proxy.ts picks one by the language cookie.
 */
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <PageTransition>
        <LoginLabel language="en" />
      </PageTransition>
    </main>
  );
}
