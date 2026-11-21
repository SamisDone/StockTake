import type { Metadata } from "next";
import { PageTransition } from "@/components/transitions";
import { landingMetadata } from "../../../(marketing)/landing";
import { LOGIN_TITLE, LoginLabel } from "../../login/login-label";

// The root layout's description is English; the Bangla twin carries the Bangla one.
export const metadata: Metadata = { title: LOGIN_TITLE.bn, description: landingMetadata("bn").description };

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
