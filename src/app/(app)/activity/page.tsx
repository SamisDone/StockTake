import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ViewTransition, type ReactNode } from "react";
import { getDb } from "@/db/client";
import { hasActivityBefore, listActivity, listPeople } from "@/domain/activity";
import { PageHeader } from "@/components/page-header";
import { PageTransition, Reveal } from "@/components/transitions";
import { formatCount, formatDate, formatTime } from "@/lib/format";
import { getCurrentUser } from "@/server/dal";
import {
  type FeedEntry,
  type FeedItem,
  KINDS,
  type Kind,
  PAGE_DAYS,
  dayLabel,
  dayParam,
  groupFeed,
  readFeedParams,
} from "./feed";

export const metadata: Metadata = { title: "Activity" };

/** A week can't hold more than this many entries on the page; the demo's busiest week holds about 200. */
const WEEK_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <PageTransition>
      <PageHeader title="Activity" />
      <Reveal fallback={<FeedPlaceholder />}>
        <Feed searchParams={searchParams} />
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
async function Feed({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  await getCurrentUser();
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
        <FilterRow legend="Show">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <FilterLink key={k} href={feedHref({ kind: k, userId, before })} current={k === kind}>
              {KINDS[k].label}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow legend="Who" className="border-ink max-lg:border-t lg:border-l">
          <FilterLink href={feedHref({ kind, before })} current={userId === undefined}>
            Everyone
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
              {latest ? "This week" : `Week to ${formatDate(lastDay, now)}`}
              <span className="ml-2 text-sm font-normal text-ink-2">
                {formatDate(from, now)} – {formatDate(lastDay, now)}
              </span>
            </h2>
            <p className="text-sm text-ink-2">
              {formatCount(entries.length)} {entries.length === 1 ? "entry" : "entries"} · times are UTC
            </p>
          </div>

          {days.length === 0 ? (
            <p className="mt-4 px-5 font-semibold sm:px-8">
              Nothing {kind === "all" ? "" : `in ${KINDS[kind].label.toLowerCase()} `}
              {userId !== undefined ? `by ${people.find((p) => p.id === userId)?.name ?? "them"} ` : ""}
              this week.
            </p>
          ) : (
            days.map(({ day, items }) => (
              <section key={day} aria-labelledby={`day-${day}`} className="mt-5">
                <h3 id={`day-${day}`} className="border-b border-ink px-5 pb-2 font-semibold sm:px-8">
                  {dayLabel(day, now)}
                  {["Today", "Yesterday"].includes(dayLabel(day, now)) ? (
                    <span className="ml-2 text-sm font-normal text-ink-2">
                      {formatDate(new Date(`${day}T00:00:00Z`), now)}
                    </span>
                  ) : null}
                </h3>
                <ul>
                  {items.map((item) => (
                    <Item
                      key={item.kind === "entry" ? item.entry.id : `sales-${item.entries[0].id}`}
                      item={item}
                      who={userId === undefined}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          <nav aria-label="Weeks" className="mt-6 flex justify-between gap-4 px-5 sm:px-8">
            {earlier ? (
              <PageLink href={feedHref({ kind, userId, before: dayParam(from) })} direction="earlier">
                Earlier week
              </PageLink>
            ) : (
              <p className="flex min-h-11 items-center text-sm text-ink-2">The log starts here.</p>
            )}
            {latest ? null : (
              <PageLink href={feedHref({ kind, userId, before: laterBefore })} direction="later">
                Later week
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

function Item({ item, who }: { item: FeedItem; who: boolean }) {
  if (item.kind === "entry") return <Entry entry={item.entry} who={who} />;
  const { entries, userName } = item;
  const products = new Set(entries.map((e) => e.entityId)).size;
  const latest = formatTime(entries[0].occurredAt);
  const earliest = formatTime(entries.at(-1)!.occurredAt);
  return (
    <li className="border-b border-hairline last:border-b-0">
      <details className="group">
        <summary
          className={`${row(who)} cursor-pointer list-none transition-colors duration-150 hover:bg-liner/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden`}
        >
          <time dateTime={entries[0].occurredAt.toISOString()} className="tabular text-sm text-ink-2">
            {formatTime(entries[0].occurredAt)}
          </time>
          {who ? <span className="truncate text-sm font-semibold max-sm:hidden">{userName ?? "Someone"}</span> : null}
          <span className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-semibold">{formatCount(entries.length)} sales</span>
              <span className="text-ink-2">
                {" "}
                of {formatCount(products)} {products === 1 ? "product" : "products"}
                {/* The time column has the latest; a run spread over the day says where it began. */}
                {earliest === latest ? null : `, since ${earliest}`}
              </span>
              {who ? <span className="block text-xs text-ink-3 sm:hidden">{userName ?? "Someone"}</span> : null}
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
            <Entry key={entry.id} entry={entry} who={who} nested />
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
function Entry({ entry, who, nested = false }: { entry: FeedEntry; who: boolean; nested?: boolean }) {
  const href = entityHref(entry);
  return (
    <li
      className={`${row(who)} relative ${nested ? "" : "border-b border-hairline last:border-b-0"} ${href ? "transition-colors duration-150 hover:bg-liner/60" : ""}`}
    >
      <time dateTime={entry.occurredAt.toISOString()} className="tabular text-sm text-ink-2">
        {formatTime(entry.occurredAt)}
      </time>
      {who ? (
        <span className="truncate text-sm font-semibold max-sm:hidden">
          {nested ? null : (entry.userName ?? "Someone")}
        </span>
      ) : null}
      <p className="min-w-0 text-sm">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          >
            {entry.summary}
          </Link>
        ) : (
          entry.summary
        )}
        {who && !nested ? (
          <span className="block text-xs text-ink-3 sm:hidden">{entry.userName ?? "Someone"}</span>
        ) : null}
      </p>
    </li>
  );
}

/** A row of filter links, printed like the lists' choices: the current one is reverse print. */
function FilterRow({ legend, className = "", children }: { legend: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={legend} className={`min-w-0 pt-2.5 pb-2 ${className}`}>
      <p aria-hidden className="field-name px-5 sm:px-8">
        {legend}
      </p>
      {/* On a phone the choices scroll sideways rather than wrap. */}
      <div className="mt-1 flex gap-1 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:px-8 lg:px-6">
        {children}
      </div>
    </div>
  );
}

function FilterLink({ href, current, children }: { href: Route; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      prefetch={false}
      aria-current={current ? "true" : undefined}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-control px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 select-none pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current ${
        current ? "bg-ink text-label" : "text-ink-2 hover:bg-liner hover:text-ink"
      }`}
    >
      {children}
    </Link>
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
function FeedPlaceholder() {
  return (
    <div aria-hidden>
      <div className="grid border-b-2 border-ink lg:grid-cols-2">
        {["Show", "Who"].map((name, i) => (
          <div key={name} className={`pt-2.5 pb-2 ${i === 1 ? "border-ink max-lg:border-t lg:border-l" : ""}`}>
            <p className="field-name px-5 sm:px-8">{name}</p>
            <div className="mt-1 flex gap-1 px-5 pb-0.5 sm:px-8 lg:px-6">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="h-9 w-24 rounded-control bg-liner/70" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-5 sm:px-8">
        <p className="text-lg font-bold">This week</p>
      </div>
      <div className="mt-5 space-y-3 px-5 sm:px-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-6 bg-liner/70" />
        ))}
      </div>
    </div>
  );
}
