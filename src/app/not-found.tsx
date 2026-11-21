import type { Metadata } from "next";
import { Suspense } from "react";
import { NotFoundLabel } from "@/components/not-found-label";
import { getLanguage } from "@/server/preferences";

export const metadata: Metadata = { title: "Not found" };

/** An address that matches nothing: the 404 on a label of its own, on the liner. */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="sheet w-full max-w-120 overflow-hidden">
        <Suspense fallback={<NotFoundLabel language="en" inApp={false} />}>
          <Localized />
        </Suspense>
      </div>
    </main>
  );
}

async function Localized() {
  return <NotFoundLabel language={await getLanguage()} inApp={false} />;
}
