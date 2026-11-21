import { Suspense } from "react";
import { NotFoundLabel } from "@/components/not-found-label";
import { getLanguage } from "@/server/preferences";

/**
 * A record that doesn't exist (/products/9999), printed in the app's own sheet so the
 * rail and the person's tag stay as they were, with the way back in.
 */
export default function NotFound() {
  return (
    <Suspense fallback={<NotFoundLabel language="en" inApp />}>
      <Localized />
    </Suspense>
  );
}

async function Localized() {
  return <NotFoundLabel language={await getLanguage()} inApp />;
}
