import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listTeam } from "@/domain/people";
import { EitherLanguage } from "@/components/either-language";
import { PageHeader } from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/transitions";
import { WithLanguage } from "@/components/with-language";
import { formats } from "@/lib/format";
import { type Language, both } from "@/lib/i18n";
import { getCurrentUser } from "@/server/dal";
import { getLanguage } from "@/server/preferences";
import { PEOPLE_COPY, type PeopleCopy } from "./copy";
import { AddPerson, PersonActions, YourPassword } from "./people-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: PEOPLE_COPY[await getLanguage()].title };
}

export default function PeoplePage() {
  return (
    <PageTransition>
      <PageHeader title={both(PEOPLE_COPY, (t) => t.title)} />
      <Reveal fallback={<EitherLanguage>{(language) => <TeamPlaceholder t={PEOPLE_COPY[language]} />}</EitherLanguage>}>
        <WithLanguage>{(language) => <Team language={language} />}</WithLanguage>
      </Reveal>
    </PageTransition>
  );
}

/**
 * The team: who can sign in and as what, with an admin's controls on each person, a
 * way to add someone, and the reader's own password. Everyone sees the list; only an
 * admin changes it.
 */
async function Team({ language }: { language: Language }) {
  const t = PEOPLE_COPY[language];
  const f = formats(language);
  const user = await getCurrentUser();
  await connection();
  const db = await getDb();
  const now = new Date();
  const team = await listTeam(db);
  const isAdmin = user.role === "admin";
  const me = team.find((p) => p.id === user.id);

  return (
    <>
      <div className="border-b-2 border-ink px-5 pt-1 pb-4 sm:px-8">
        <p className="max-w-prose text-sm text-ink-2">{t.intro}</p>
        <p className="mt-2 max-w-prose text-sm text-ink-2">{isAdmin ? t.demoNote : t.staffNote}</p>
      </div>

      <section aria-labelledby="team-title">
        <div className="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-8">
          <h2 id="team-title" className="text-lg font-bold">
            {t.team}
          </h2>
          <p className="text-sm text-ink-2">{t.count(team.length)}</p>
        </div>
        {/* One set of columns for every row (subgrid), so a role sits in the same place
            whether or not its row has controls. */}
        <ul className="mt-3 grid grid-cols-1 border-t border-ink md:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]">
          {team.map((person) => {
            const mine = person.id === user.id;
            return (
              <li
                key={person.id}
                className="col-span-full grid grid-cols-subgrid items-center gap-x-6 gap-y-2 border-b border-hairline px-5 py-3 last:border-b-0 sm:px-8"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                    {person.name}
                    {mine ? <Mark>{t.you}</Mark> : null}
                    {person.demo ? <Mark>{t.demo}</Mark> : null}
                  </p>
                  <p className="truncate text-sm text-ink-2">{person.email}</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold">{t.roles[person.role]}</p>
                  <p className="text-ink-3">{t.added(f.date(person.addedAt, now))}</p>
                </div>
                {isAdmin && !mine && !person.demo ? (
                  <PersonActions personId={person.id} name={person.name} role={person.role} language={language} />
                ) : (
                  <span aria-hidden className="max-md:hidden" />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin ? <AddPerson language={language} /> : null}
      <YourPassword language={language} demo={me?.demo ?? false} />
    </>
  );
}

/** A small ruled mark beside a name: "You", "Demo account". */
function Mark({ children }: { children: string }) {
  return <span className="rounded-mark border border-ink-3 px-1.5 py-px text-xs font-bold text-ink-2">{children}</span>;
}

function TeamPlaceholder({ t }: { t: PeopleCopy }) {
  return (
    <div aria-hidden>
      <div className="border-b-2 border-ink px-5 pt-1 pb-4 sm:px-8">
        <div className="h-4 w-4/5 max-w-prose bg-liner/70" />
        <div className="mt-2 h-4 w-3/5 max-w-prose bg-liner/70" />
      </div>
      <p className="px-5 pt-5 text-lg font-bold sm:px-8">{t.team}</p>
      <div className="mt-3 space-y-px border-t border-ink">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="px-5 py-3 sm:px-8">
            <div className="h-5 w-48 bg-liner" />
            <div className="mt-1.5 h-4 w-64 bg-liner/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
