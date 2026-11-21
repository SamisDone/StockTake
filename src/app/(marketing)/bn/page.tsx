import { Landing, landingMetadata } from "../landing";

export const metadata = landingMetadata("bn");

/** The landing page in Bangla, prerendered like the English one. proxy.ts serves it at / to Bangla readers. */
export default function BanglaLandingPage() {
  return <Landing language="bn" />;
}
