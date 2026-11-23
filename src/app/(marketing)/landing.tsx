import type { Metadata } from "next";
import Link from "next/link";
import { DemoDoors } from "@/components/demo-doors";
import { LanguageSwitch } from "@/components/language-switch";
import { Mark } from "@/components/logo";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { formats } from "@/lib/format";
import { LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { REFUSALS } from "@/lib/refusals";
import { parseDayKey } from "@/lib/business-time";
import { COPY, type LandingCopy, type MovementKind } from "./copy";
import { LiveRefusal } from "./live-refusal";
import "./landing.css";

/**
 * The landing page, in either language. It's prerendered once per language (`/` and
 * `/bn`); proxy.ts serves the reader's from the language cookie, so neither reads the
 * request and both stay static.
 *
 * It acts out what it says: writes are refused and stamped, the ledger prints and tallies.
 * Everything that moves is a simulation over the verified answers in `src/lib/refusals.ts`;
 * the page never touches the database.
 */

export function landingMetadata(language: Language): Metadata {
  const t = COPY[language];
  return { title: { absolute: t.metaTitle }, description: t.metaDescription };
}

export function Landing({ language }: { language: Language }) {
  const t = COPY[language];
  return (
    <div lang={LANGUAGE_TAGS[language]} className="landing mx-auto max-w-6xl px-4 sm:px-8">
      <div aria-hidden className="landing-grain" />
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href="/" lang="en" className="print-display flex items-center gap-2.5 text-2xl uppercase">
          <Mark size={32} />
          Stocktake
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitch language={language} variant="toggle" prerendered />
          {/* No prefetch: on Workers the /login route-tree prefetch costs ~100 ms of CPU per
              landing view, and most visitors take the demo doors instead. */}
          <Link
            href="/login"
            prefetch={false}
            className="-mx-1 flex min-h-11 items-center px-1 text-sm font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
          >
            {t.signIn}
          </Link>
        </div>
      </header>

      <main>
        <Hero t={t} language={language} />
        <Refusals t={t} language={language} />
        <Ledger t={t} language={language} />
        <TwoWaysIn t={t} language={language} />
      </main>

      <footer className="mt-24 border-t-2 border-ink py-8 text-sm text-ink-2">
        <p className="max-w-2xl">
          {t.footer[0]}
          <a
            href="https://github.com/SamisDone/StockMaster-Main"
            className="font-semibold text-ink underline decoration-ink-3 hover:decoration-ink"
          >
            StockMaster
          </a>
          {t.footer[1]}
        </p>
      </footer>
    </div>
  );
}

type Props = { t: LandingCopy; language: Language };

/** A section's ledger entry number, above its heading. */
function Marker({ children }: { children: string }) {
  return (
    <p aria-hidden className="ledger-marker">
      {children}
    </p>
  );
}

/** The claim, the way in, and the proof under it: a write the database turned down. */
function Hero({ t, language }: Props) {
  return (
    <section className="pt-6 pb-20 lg:pt-10">
      <Marker>{t.markers.receipt}</Marker>
      <h1 className="print-display mt-4 text-[clamp(4rem,10vw,10rem)]">
        {t.headline.map((line, index) => (
          <span key={line} className="block">
            {line}
            {index < t.headline.length - 1 ? " " : null}
          </span>
        ))}
      </h1>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:mt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <p className="max-w-[34rem] text-lg leading-relaxed text-ink-2">{t.lede}</p>
          <div className="mt-8 max-w-md">
            <DemoDoors language={language} receipt />
          </div>
        </div>

        <LiveRefusal language={language} />
      </div>
    </section>
  );
}

/** Six writes someone might try, each with the database's own answer. */
function Refusals({ t, language }: Props) {
  const f = formats(language);
  return (
    <section aria-labelledby="refusals-title" className="py-12">
      <Marker>{t.markers.refusals}</Marker>
      <h2 id="refusals-title" className="print-display mt-3 text-4xl sm:text-5xl">
        {t.breakIt}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{t.breakItLede}</p>

      <ol className="receipt torn mt-8">
        {REFUSALS.map(({ attempt, sql, refusal }, index) => (
          <li
            key={sql}
            className="grid gap-x-6 gap-y-2 border-b border-hairline px-5 py-4 last:border-b-0 sm:px-6 md:grid-cols-[2.5rem_minmax(0,13rem)_minmax(0,1fr)_minmax(0,16rem)] md:items-baseline"
          >
            <span aria-hidden className="font-mono text-xs text-ink-3">
              #{f.count(index + 1)}
            </span>
            <p className="font-semibold">{attempt[language]}</p>
            <code className="font-mono text-xs leading-relaxed break-words text-ink-2">{sql}</code>
            <p className="refusal-stamp justify-self-start px-2 py-1 font-mono text-xs leading-relaxed font-semibold">
              {refusal}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-2xl text-sm text-ink-2">{t.breakItNote}</p>
    </section>
  );
}

/** An example product's October, on the business's clock like every ledger date. */
const EXAMPLE_MOVEMENTS: {
  day: number;
  kind: MovementKind;
  detail: "order" | "crushed" | "found" | null;
  quantity: number;
}[] = [
  { day: 2, kind: "receipt", detail: "order", quantity: 120 },
  { day: 5, kind: "sale", detail: null, quantity: -36 },
  { day: 11, kind: "sale", detail: null, quantity: -40 },
  { day: 14, kind: "return", detail: null, quantity: 4 },
  { day: 19, kind: "writeOff", detail: "crushed", quantity: -6 },
  { day: 28, kind: "count", detail: "found", quantity: -2 },
];

/** Each movement with the running balance after it; the last balance is the number on hand. */
const LEDGER_ROWS = EXAMPLE_MOVEMENTS.map((movement, index) => ({
  ...movement,
  balance: EXAMPLE_MOVEMENTS.slice(0, index + 1).reduce((sum, m) => sum + m.quantity, 0),
}));
const ON_HAND = LEDGER_ROWS[LEDGER_ROWS.length - 1].balance;

/** How a count is made: the ledger, with its running balance, ending in the number on hand. */
function Ledger({ t, language }: Props) {
  const f = formats(language);
  const october = (day: number) => parseDayKey(`2026-10-${String(day).padStart(2, "0")}`)!;
  return (
    <section
      aria-labelledby="ledger-title"
      className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start"
    >
      <div>
        <Marker>{t.markers.balance}</Marker>
        <h2 id="ledger-title" className="print-display mt-3 text-4xl sm:text-5xl">
          {t.sum}
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{t.sumLede}</p>
      </div>

      <figure className="receipt torn-top">
        <div className="flex items-end justify-between gap-4 border-b-2 border-ink px-5 pt-3 pb-3 sm:px-6">
          <div>
            <p className="field-name">{t.product}</p>
            <p className="font-semibold">
              {t.tape} <span className="font-mono text-xs font-normal text-ink-3">PKG-TAPE</span>
            </p>
          </div>
          <p className="field-name">{t.example}</p>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <th scope="col" className="field-name py-2 pl-5 font-semibold sm:pl-6">
                {t.columns.date}
              </th>
              <th scope="col" className="field-name py-2 pl-3 font-semibold">
                {t.columns.movement}
              </th>
              <th scope="col" className="field-name py-2 pl-3 text-right font-semibold">
                {t.columns.units}
              </th>
              <th scope="col" className="field-name py-2 pr-5 pl-3 text-right font-semibold sm:pr-6">
                {t.columns.balance}
              </th>
            </tr>
          </thead>
          <tbody>
            {LEDGER_ROWS.map((row) => (
              <tr key={row.day} className="border-b border-hairline">
                <td className="tabular py-2.5 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">
                  {f.date(october(row.day), october(1))}
                </td>
                <td className="py-2.5 pl-3">
                  <span className="font-semibold">{t.kinds[row.kind]}</span>
                  {row.detail ? (
                    <span className={`text-ink-2 ${row.detail === "order" ? "font-mono text-xs" : ""}`}>
                      {" "}
                      · {t.details[row.detail]}
                    </span>
                  ) : null}
                </td>
                <td className="tabular py-2.5 pl-3 text-right">{f.change(row.quantity)}</td>
                <td className="tabular py-2.5 pr-5 pl-3 text-right font-semibold sm:pr-6">{f.count(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end justify-between gap-4 bg-ink px-5 pt-3 pb-4 text-label sm:px-6">
          <p className="text-sm font-semibold">{t.onHand}</p>
          <p className="print-display tabular text-5xl">{f.count(ON_HAND)}</p>
        </div>
      </figure>
    </section>
  );
}

/** The two seats in the demo, and the door to each. */
function TwoWaysIn({ t, language }: Props) {
  return (
    <section aria-labelledby="ways-title" className="py-12">
      <Marker>{t.markers.access}</Marker>
      <h2 id="ways-title" className="print-display mt-3 text-4xl sm:text-5xl">
        {t.twoWays}
      </h2>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
        <dl className="grid gap-6 sm:grid-cols-2">
          {DEMO_ROLES[language].map(({ role, label }) => (
            <div key={role} className="border-t-2 border-ink pt-3">
              <dt className="text-lg font-bold">{label}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{t.work[role]}</dd>
            </div>
          ))}
        </dl>
        <DemoDoors language={language} name={t.openAs} receipt />
      </div>
      <p className="mt-6 max-w-2xl text-sm text-ink-2">{t.demoNote}</p>
    </section>
  );
}
