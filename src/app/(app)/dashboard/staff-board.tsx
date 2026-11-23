import { Phone } from "lucide-react";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { activityText } from "@/domain/activity-copy";
import { COUNT_EVERY_DAYS, staffHome } from "@/domain/home";
import { IntentLink } from "@/components/intent-link";
import { ProductLink } from "@/components/product-link";
import { Tally } from "@/components/stock";
import { NAV_FORWARD } from "@/components/transitions";
import { daysBetween } from "@/lib/business-time";
import { formats } from "@/lib/format";
import type { Copy, Language } from "@/lib/i18n";

/** How many shelves the board lists before it says how many more there are. */
const SHELVES_SHOWN = 8;

/**
 * The stockroom's home: what to do now, in the order it's usually done. Deliveries to
 * receive (late ones first, with the supplier's number to chase them), the shelves due
 * a count (each opens the product, where the count is recorded), and what you've
 * recorded today. The Record button is the way to all three.
 */
export async function StaffBoard({ userId, language }: { userId: number; language: Language }) {
  const t = COPY[language];
  const f = formats(language);
  await connection();
  const db = await getDb();
  const now = new Date();
  const { deliveries, countsDue, today } = await staffHome(db, userId, now);
  const late = deliveries.filter((d) => d.late).length;

  return (
    <>
      <dl className="grid grid-cols-3 border-b-2 border-ink">
        <Tally name={t.tallies[0]} value={deliveries.length} language={language}>
          {late > 0 ? <p className="mt-1 text-sm font-semibold">{t.lateCount(f.count(late))}</p> : null}
        </Tally>
        <Tally name={t.tallies[1]} value={countsDue.length} language={language} />
        <Tally name={t.tallies[2]} value={today.length} language={language} />
      </dl>

      <Section id="deliveries" title={t.deliveries} help={t.deliveriesHelp}>
        {deliveries.length === 0 ? (
          <Empty>{t.noDeliveries}</Empty>
        ) : (
          <ul className="mt-3 border-t border-ink">
            {deliveries.map((d) => {
              const due = daysBetween(now, d.dueAt);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hairline px-5 py-3 last:border-b-0 sm:px-8"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                      {d.late ? (
                        <span className="rounded-mark bg-stock px-1.5 py-px text-xs font-bold">
                          {t.late(f.days(d.daysLate))}
                        </span>
                      ) : null}
                      {d.supplierName}
                    </p>
                    <p className="text-sm text-ink-2">
                      <span className="font-mono text-xs">{d.number}</span> ·{" "}
                      {d.late ? t.wasDue(f.date(d.dueAt, now)) : due <= 0 ? t.dueToday : t.dueTomorrow} ·{" "}
                      {t.lines(d.lines, f.count(d.lines))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.late && d.phone ? (
                      <a
                        href={`tel:${d.phone.replace(/[^\d+]/g, "")}`}
                        className="press-quiet flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
                      >
                        <Phone aria-hidden size={16} strokeWidth={2.25} />
                        <span className="sr-only">{t.call(d.supplierName)}</span>
                        <span aria-hidden>{d.phone}</span>
                      </a>
                    ) : null}
                    <IntentLink
                      href={`/orders/${d.id}`}
                      transitionTypes={NAV_FORWARD}
                      className="group flex min-h-11 items-center rounded-control bg-ink px-4 text-sm font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
                    >
                      <span className="transition-transform duration-150 ease-out group-active:scale-[0.96]">
                        {t.receive}
                        <span className="sr-only"> {d.number}</span>
                      </span>
                    </IntentLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="counts" title={t.counts} help={t.countsHelp(f.count(COUNT_EVERY_DAYS))}>
        {countsDue.length === 0 ? (
          <Empty>{t.noCounts(f.count(COUNT_EVERY_DAYS))}</Empty>
        ) : (
          <>
            <ul className="mt-3 border-t border-ink">
              {countsDue.slice(0, SHELVES_SHOWN).map((p) => (
                <li
                  key={p.id}
                  className="relative flex items-baseline justify-between gap-6 border-b border-hairline px-5 py-3 row-hit last:border-b-0 sm:px-8"
                >
                  <div className="min-w-0">
                    {/* The name opens the product, where the count is recorded; it stretches over the row. */}
                    <ProductLink
                      id={p.id}
                      className="font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                    >
                      {p.name}
                    </ProductLink>
                    <p className="text-sm text-ink-3">
                      <span className="font-mono text-xs">{p.sku}</span>
                      {p.category ? <> · {p.category}</> : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm text-ink-2">
                    {p.lastCountedAt ? t.countedOn(f.date(p.lastCountedAt, now)) : t.neverCounted}
                  </p>
                </li>
              ))}
            </ul>
            {countsDue.length > SHELVES_SHOWN ? (
              <p className="px-5 pt-3 text-sm text-ink-2 sm:px-8">
                {t.more(f.count(countsDue.length - SHELVES_SHOWN))}
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section id="today" title={t.today} last>
        {today.length === 0 ? (
          <Empty>
            {/* The R key only means something where there's a keyboard, beside the rail. */}
            {t.nothingToday[0]}
            <span className="hidden lg:inline">{t.nothingToday[1]}</span>
            {t.nothingToday[2]}
          </Empty>
        ) : (
          <ol className="mt-3 border-t border-ink">
            {today.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-4 border-b border-hairline px-5 py-2.5 text-sm last:border-b-0 sm:px-8"
              >
                <span className="w-16 shrink-0 text-ink-2 lang-bn:w-24">{f.time(entry.occurredAt)}</span>
                <span className="min-w-0">{activityText(language, entry)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

function Section({
  id,
  title,
  help,
  last = false,
  children,
}: {
  id: string;
  title: string;
  help?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={`pt-6 ${last ? "pb-8" : "border-b-2 border-ink pb-6"}`}>
      <h2 id={`${id}-title`} className="px-5 text-lg font-bold sm:px-8">
        {title}
      </h2>
      {help ? <p className="mt-1 max-w-prose px-5 text-sm text-ink-2 sm:px-8">{help}</p> : null}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-prose px-5 text-ink-2 sm:px-8">{children}</p>;
}

const en = {
  tallies: ["To receive", "Shelves to count", "Recorded today"],
  lateCount: (n: string) => `${n} late`,
  deliveries: "Deliveries to receive",
  deliveriesHelp: "Late ones first, then what's due today and tomorrow. Receive books every line into stock.",
  noDeliveries: "Nothing is due today or tomorrow, and nothing is late.",
  late: (days: string) => `Late ${days}`,
  wasDue: (day: string) => `was due ${day}`,
  dueToday: "due today",
  dueTomorrow: "due tomorrow",
  lines: (n: number, text: string) => `${text} ${n === 1 ? "line" : "lines"}`,
  call: (supplier: string) => `Call ${supplier}`,
  receive: "Receive",
  counts: "Shelves to count",
  countsHelp: (days: string) => `Not counted in ${days} days, longest first. Open one and record what's on the shelf.`,
  noCounts: (days: string) => `Every shelf has been counted in the last ${days} days.`,
  countedOn: (day: string) => `Counted ${day}`,
  neverCounted: "Never counted",
  more: (n: string) => `And ${n} more. The longest-waiting are listed first.`,
  today: "Your entries today",
  nothingToday: ["Nothing recorded yet today. Press Record", " (or R)", " to start."] as [string, string, string],
};

const COPY: Copy<typeof en> = {
  en,
  bn: {
    tallies: ["বুঝে নিতে হবে", "যে তাক গুনতে হবে", "আজ লেখা হয়েছে"],
    lateCount: (n) => `${n}টি দেরিতে`,
    deliveries: "যে ডেলিভারি বুঝে নিতে হবে",
    deliveriesHelp: "আগে দেরিগুলো, তারপর আজ ও কাল যা আসার কথা। বুঝে নিলে প্রতিটি লাইন মজুতে যোগ হয়।",
    noDeliveries: "আজ বা কাল কিছু আসার কথা নেই, আর কিছু দেরিতেও নেই।",
    late: (days) => `${days} দেরি`,
    wasDue: (day) => `আসার কথা ছিল ${day}`,
    dueToday: "আজ আসার কথা",
    dueTomorrow: "কাল আসার কথা",
    lines: (_n, text) => `${text} লাইন`,
    call: (supplier) => `${supplier}-কে ফোন করুন`,
    receive: "বুঝে নিন",
    counts: "যে তাক গুনতে হবে",
    countsHelp: (days) => `${days} দিনে গোনা হয়নি, সবচেয়ে পুরোনোটি আগে। একটি খুলে তাকে যা আছে লিখুন।`,
    noCounts: (days) => `গত ${days} দিনে সব তাক গোনা হয়েছে।`,
    countedOn: (day) => `গোনা হয়েছে ${day}`,
    neverCounted: "কখনো গোনা হয়নি",
    more: (n) => `আরও ${n}টি। সবচেয়ে বেশিদিন অপেক্ষারগুলো আগে দেখানো হয়েছে।`,
    today: "আজ আপনার লেখা",
    nothingToday: ["আজ এখনো কিছু লেখা হয়নি। শুরু করতে লিখুন", " (বা R)", " চাপুন।"],
  },
};
