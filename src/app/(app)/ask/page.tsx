import type { Metadata } from "next";
import { connection } from "next/server";
import { toWire } from "@/assistant/protocol";
import { getAllowance } from "@/assistant/usage";
import { getDb } from "@/db/client";
import { PageHeader } from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/transitions";
import { getCurrentUser } from "@/server/dal";
import { getLanguage, getMoneyPrefs } from "@/server/preferences";
import type { Language } from "@/lib/i18n";
import { ASK_COPY } from "./copy";
import { Conversation } from "./conversation";
import { WithLanguage } from "@/components/with-language";
import { both } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: ASK_COPY[await getLanguage()].title };
}

export default function AskPage() {
  return (
    <PageTransition>
      <PageHeader title={both(ASK_COPY, (t) => t.title)} />
      <Reveal fallback={<AskPlaceholder />}>
        <WithLanguage>{(language) => <AskLoaded language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

/** The conversation starts with what the person can still ask today. */
async function AskLoaded({ language }: { language: Language }) {
  const user = await getCurrentUser();
  await connection();
  const [allowance, money] = await Promise.all([getAllowance(await getDb(), user.id, new Date()), getMoneyPrefs()]);
  return <Conversation initialAllowance={toWire(allowance)} money={money} language={language} />;
}

/** The intro and the question field, unprinted, holding their space while the session is read. */
function AskPlaceholder() {
  return (
    <div aria-hidden>
      <div className="space-y-3 px-5 pt-6 pb-8 sm:px-8">
        <div className="h-20 max-w-prose bg-liner" />
        <div className="h-10 max-w-prose bg-liner/70" />
      </div>
      <div className="mt-8 border-t border-ink">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 border-b border-hairline" />
        ))}
      </div>
      <div className="h-30 border-t-2 border-ink" />
    </div>
  );
}
