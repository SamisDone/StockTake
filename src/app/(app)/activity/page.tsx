import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ViewTransition } from "react";
import { getDb } from "@/db/client";
import { hasActivityBefore, listActivity, listPeople } from "@/domain/activity";
import { FilterLink, FilterRow, FilterRowPlaceholder } from "@/components/filters";
import { PageHeader } from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/transitions";
import { activityText } from "@/domain/activity-copy";
import { type Formats, formats } from "@/lib/format";
import type { Copy, Language } from "@/lib/i18n";
import { getLanguage } from "@/server/preferences";
import { getCurrentUser } from "@/server/dal";
import {
  type FeedEntry,
  type FeedItem,
  KINDS,
  type Kind,
  PAGE_DAYS,
  dayLabel,
  dayParam,
  isRecentDay,
  groupFeed,
  readFeedParams,
} from "./feed";

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await getLanguage()].title };
}

/** A week can't hold more than this many entries on the page; the demo's busiest week holds about 200. */
const WEEK_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const language = await getLanguage();
  const t = COPY[language];
  return (
    <PageTransition>
      <PageHeader title={t.title} />
      <Reveal fallback={<FeedPlaceholder t={t} />}>
        <Feed searchParams={searchParams} language={language} />
      </Reveal>
    </PageTransition>
  );
}

type Params = { kind: Kind; userId?: number; before?: string };

/** The feed's URL for a set of filters and a week. Defaults are left out, so the plain URL is the latest week of everything. */
function feedHref({ kind, userId, before }: Params) {
  const query = new URLSearchParams();
  if (kind !== "all") query.set("kind", kind);
  if (userId !== undefined) query.set("person", String(userId));
  if (before) query.set("before", before);
  const text = query.toString();
  return (text ? `/activity?${text}` : "/activity") as Route;
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Who did what, a week at a time, newest first. The log is append-only in the
 * database, so this is the record as it was written. Filters and the week live in the
 * URL, so any view can be shared.
 */
async function Feed({
  searchParams,
  language,
}: {
  searchParams: PageProps<"/activity">["searchParams"];
  language: Language;
}) {
  await getCurrentUser();
  const t = COPY[language];
  const f = formats(language);
  const raw = await searchParams;
  // "This week" and "today" are relative to now.
  await connection();
  const db = await getDb();
  const now = new Date();
  const { kind, userId, from, to } = readFeedParams(
    { kind: one(raw.kind), person: one(raw.person), before: one(raw.before) },
    now,
  );
  const filter = { actions: [...KINDS[kind].actions], userId };
  const [entries, people, earlier] = await Promise.all([
    listActivity(db, { ...filter, from, to, limit: WEEK_LIMIT }),
    listPeople(db),
    hasActivityBefore(db, from, filter),
  ]);
  const days = groupFeed(entries);
  const latest = to.getTime() > now.getTime();
  const before = latest ? undefined : dayParam(to);
  const lastDay = new Date(to.getTime() - 1);
  // The week after this one; the latest week has no `before`.
  const laterTo = new Date(to.getTime() + PAGE_DAYS * DAY_MS);
  const laterBefore = laterTo.getTime() > now.getTime() ? undefined : dayParam(laterTo);

  return (
    <>
      <div className="grid border-b-2 border-ink lg:grid-cols-2">
        <FilterRow legend={t.show}>
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <FilterLink key={k} href={feedHref({ kind: k, userId, before })} current={k === kind}>
              {t.kinds[k]}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow legend={t.who} className="border-ink max-lg:border-t lg:border-l">
          <FilterLink href={feedHref({ kind, before })} current={userId === undefined}>
            {t.everyone}
          </FilterLink>
          {people.map((p) => (
            <FilterLink key={p.id} href={feedHref({ kind, userId: p.id, before })} current={p.id === userId}>
              {p.name}
            </FilterLink>
          ))}
        </FilterRow>
      </div>

      {/* A new filter or week is new content in the same place: the old tears off, the new prints in. */}
      <ViewTransition key={`${kind}|${userId}|${before}`} enter="print" exit="tear" default="none">
        <section aria-labelledby="week-title" className="pb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-5 sm:px-8">
            <h2 id="week-title" className="text-lg font-bold">
              {latest ? t.thisWeek : t.weekTo(f.date(lastDay, now))}
              <span className="ml-2 text-sm font-normal text-ink-2">
                {f.date(from, now)} – {f.date(lastDay, now)}
              </span>
            </h2>
            <p className="text-sm text-ink-2">{t.entries(entries.length, f.count(entries.length))}</p>
          </div>

          {days.length === 0 ? (
            <p className="mt-4 px-5 font-semibold sm:px-8">
              {t.nothing(
                kind === "all" ? null : kind,
                userId !== undefined ? (people.find((p) => p.id === userId)?.name ?? null) : undefined,
              )}
            </p>
          ) : (
            days.map(({ day, items }) => (
              <section key={day} aria-labelledby={`day-${day}`} className="mt-5">
                <h3 id={`day-${day}`} className="border-b border-ink px-5 pb-2 font-semibold sm:px-8">
                  {dayLabel(day, now, language)}
                  {isRecentDay(day, now) ? (
                    <span className="ml-2 text-sm font-normal text-ink-2">
                      {f.date(new Date(`${day}T00:00:00Z`), now)}
                    </span>
                  ) : null}
                </h3>
                <ul>
                  {items.map((item) => (
                    <Item
                      key={item.kind === "entry" ? item.entry.id : `sales-${item.entries[0].id}`}
                      item={item}
                      who={userId === undefined}
                      f={f}
                      t={t}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          <nav aria-label={t.weeks} className="mt-6 flex justify-between gap-4 px-5 sm:px-8">
            {earlier ? (
              <PageLink href={feedHref({ kind, userId, before: dayParam(from) })} direction="earlier">
                {t.earlier}
              </PageLink>
            ) : (
              <p className="flex min-h-11 items-center text-sm text-ink-2">{t.starts}</p>
            )}
            {latest ? null : (
              <PageLink href={feedHref({ kind, userId, before: laterBefore })} direction="later">
                {t.later}
              </PageLink>
            )}
          </nav>
        </section>
      </ViewTransition>
    </>
  );
}

/** Where an entry leads: the thing it's about, when that has a page. */
function entityHref(entry: FeedEntry): Route | null {
  if (entry.entityType === "product") return `/products/${entry.entityId}` as Route;
  if (entry.entityType === "purchase_order") return `/orders/${entry.entityId}` as Route;
  if (entry.entityType === "supplier") return `/suppliers/${entry.entityId}` as Route;
  return null;
}

/** A row's columns: when, who (left out when the feed is one person's), and what. */
const row = (who: boolean) =>
  `grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-4 px-5 py-2.5 sm:px-8 ${who ? "sm:grid-cols-[5.25rem_9rem_minmax(0,1fr)]" : "sm:grid-cols-[5.25rem_minmax(0,1fr)]"}`;

function Item({ item, who, f, t }: { item: FeedItem; who: boolean; f: Formats; t: ActivityCopy }) {
  if (item.kind === "entry") return <Entry entry={item.entry} who={who} f={f} t={t} />;
  const { entries, userName } = item;
  const products = new Set(entries.map((e) => e.entityId)).size;
  const latest = f.time(entries[0].occurredAt);
  const earliest = f.time(entries.at(-1)!.occurredAt);
  return (
    <li className="border-b border-hairline last:border-b-0">
      <details className="group">
        <summary
          className={`${row(who)} cursor-pointer list-none transition-colors duration-150 hover:bg-liner/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden`}
        >
          <time dateTime={entries[0].occurredAt.toISOString()} className="tabular text-sm text-ink-2">
            {latest}
          </time>
          {who ? <span className="truncate text-sm font-semibold max-sm:hidden">{userName ?? t.someone}</span> : null}
          <span className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-semibold">{t.sales(f.count(entries.length))}</span>
              <span className="text-ink-2">
                {t.ofProducts(products, f.count(products))}
                {/* The time column has the latest; a run spread over the day says where it began. */}
                {earliest === latest ? null : t.since(earliest)}
              </span>
              {who ? <span className="block text-xs text-ink-3 sm:hidden">{userName ?? t.someone}</span> : null}
            </span>
            <ChevronDown
              aria-hidden
              size={18}
              strokeWidth={2.25}
              className="shrink-0 text-ink-2 transition-transform duration-150 ease-out group-open:rotate-180"
            />
          </span>
        </summary>
        <ul className="border-t border-hairline bg-liner/40">
          {entries.map((entry) => (
            <Entry key={entry.id} entry={entry} who={who} f={f} t={t} nested />
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * One entry: when, who, and what, which opens what it's about. The whole row is the hit
 * area. Inside an open run of sales the run already says who, so its rows don't repeat
 * it; when the feed is one person's, no row does.
 */
function Entry({
  entry,
  who,
  f,
  t,
  nested = false,
}: {
  entry: FeedEntry;
  who: boolean;
  f: Formats;
  t: ActivityCopy;
  nested?: boolean;
}) {
  const href = entityHref(entry);
  const text = activityText(f.language, entry);
  return (
    <li
      className={`${row(who)} relative ${nested ? "" : "border-b border-hairline last:border-b-0"} ${href ? "transition-colors duration-150 hover:bg-liner/60" : ""}`}
    >
      <time dateTime={entry.occurredAt.toISOString()} className="tabular text-sm text-ink-2">
        {f.time(entry.occurredAt)}
      </time>
      {who ? (
        <span className="truncate text-sm font-semibold max-sm:hidden">
          {nested ? null : (entry.userName ?? t.someone)}
        </span>
      ) : null}
      <p className="min-w-0 text-sm">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {text}
          </Link>
        ) : (
          text
        )}
        {who && !nested ? (
          <span className="block text-xs text-ink-3 sm:hidden">{entry.userName ?? t.someone}</span>
        ) : null}
      </p>
    </li>
  );
}

function PageLink({ href, direction, children }: { href: Route; direction: "earlier" | "later"; children: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`press-quiet flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-liner ${
        direction === "earlier" ? "-ml-3" : "-mr-3 ml-auto"
      }`}
    >
      {direction === "earlier" ? <ArrowLeft aria-hidden size={18} strokeWidth={2.25} /> : null}
      {children}
      {direction === "later" ? <ArrowRight aria-hidden size={18} strokeWidth={2.25} /> : null}
    </Link>
  );
}

/** The same label, unprinted: the filters and a day of entries hold their space. */
function FeedPlaceholder({ t }: { t: ActivityCopy }) {
  return (
    <div aria-hidden>
      <div className="grid border-b-2 border-ink lg:grid-cols-2">
        <FilterRowPlaceholder legend={t.show} count={3} />
        <FilterRowPlaceholder legend={t.who} count={3} className="border-ink max-lg:border-t lg:border-l" />
      </div>
      <div className="px-5 pt-5 sm:px-8">
        <p className="text-lg font-bold">{t.thisWeek}</p>
      </div>
      <div className="mt-5 space-y-3 px-5 sm:px-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-6 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}

const en = {
  title: "Activity",
  show: "Show",
  who: "Who",
  everyone: "Everyone",
  someone: "Someone",
  kinds: { all: "Everything", stock: "Stock", orders: "Orders", catalog: "Catalog" } as Record<Kind, string>,
  thisWeek: "This week",
  weekTo: (day: string) => `Week to ${day}`,
  entries: (n: number, text: string) => `${text} ${n === 1 ? "entry" : "entries"} · times are UTC`,
  nothing: (kind: Exclude<Kind, "all"> | null, person: string | null | undefined) =>
    `Nothing ${kind ? `in ${{ stock: "stock", orders: "orders", catalog: "catalog" }[kind]} ` : ""}${
      person === undefined ? "" : `by ${person ?? "them"} `
    }this week.`,
  sales: (n: string) => `${n} sales`,
  ofProducts: (n: number, text: string) => ` of ${text} ${n === 1 ? "product" : "products"}`,
  since: (time: string) => `, since ${time}`,
  weeks: "Weeks",
  earlier: "Earlier week",
  later: "Later week",
  starts: "The log starts here.",
};
type ActivityCopy = typeof en;

const COPY: Copy<ActivityCopy> = {
  en,
  bn: {
    title: "কার্যক্রম",
    show: "দেখান",
    who: "কে",
    everyone: "সবাই",
    someone: "কেউ একজন",
    kinds: { all: "সব", stock: "স্টক", orders: "অর্ডার", catalog: "পণ্যতালিকা" },
    thisWeek: "এই সপ্তাহ",
    weekTo: (day) => `${day} পর্যন্ত সপ্তাহ`,
    entries: (_n, text) => `${text}টি এন্ট্রি · সময় UTC অনুযায়ী`,
    nothing: (kind, person) =>
      `এই সপ্তাহে ${person === undefined ? "" : `${person ?? "তাঁর"} `}${
        kind ? `${{ stock: "স্টকে", orders: "অর্ডারে", catalog: "পণ্যতালিকায়" }[kind]} ` : ""
      }কিছু হয়নি।`,
    sales: (n) => `${n}টি বিক্রি`,
    ofProducts: (_n, text) => `, ${text}টি পণ্যের`,
    since: (time) => `, ${time} থেকে`,
    weeks: "সপ্তাহ",
    earlier: "আগের সপ্তাহ",
    later: "পরের সপ্তাহ",
    starts: "খাতা এখান থেকে শুরু।",
  },
};
