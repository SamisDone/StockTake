import { Landing, landingMetadata } from "./landing";

export const metadata = landingMetadata("en");

/** The landing page in English. Its Bangla twin is /bn; proxy.ts picks one by the language cookie. */
export default function LandingPage() {
  return <Landing language="en" />;
}
