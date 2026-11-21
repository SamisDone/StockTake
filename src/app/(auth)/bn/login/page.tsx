import type { Metadata } from "next";
import { PageTransition } from "@/components/transitions";
import { LOGIN_TITLE, LoginLabel } from "../../login/login-label";

export const metadata: Metadata = { title: LOGIN_TITLE.bn };

/** The login page in Bangla, prerendered like the English one. proxy.ts serves it at /login to Bangla readers. */
export default function BanglaLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <PageTransition>
        <LoginLabel language="bn" />
      </PageTransition>
    </main>
  );
}
