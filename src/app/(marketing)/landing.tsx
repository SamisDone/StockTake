import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { CornerLeftUp } from "lucide-react";
import Link from "next/link";
import { DemoDoors } from "@/components/demo-doors";
import { LanguageSwitch } from "@/components/language-switch";
import { Mark } from "@/components/logo";
import { formats } from "@/lib/format";
import { LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { parseDayKey } from "@/lib/business-time";
import { COPY, type LandingCopy, type MovementKind } from "./copy";
import { AccessRow } from "./access-row";
import { AskReceipt } from "./ask-receipt";
import { INTRO_SCRIPT } from "./intro";
import { LiveRefusal } from "./live-refusal";
import { Odometer } from "./odometer";
import { RefusalRows } from "./refusal-rows";
import { ResetCountdown } from "./reset-countdown";
import { Reveals } from "./reveals";
import "./landing.css";

/**
 * The landing page, in either language. It's prerendered once per language (`/` and
 * `/bn`); proxy.ts serves the reader's from the language cookie, so neither reads the
 * request and both stay static.
 *
 * It acts out what it says: writes are refused and stamped, the ledger prints and tallies.
 * The first time it's opened in a tab, the name types itself out and the hero prints in
 * (intro.ts); further down, each section's entry number types out as it scrolls into view.
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
      {/* Before anything paints: whether this visit plays the opening. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      <Reveals />
      <div aria-hidden className="landing-grain" />
      <header className="flex items-center justify-between gap-4 py-5">
        <Link
          href="/"
          lang="en"
          aria-label="Stocktake"
          className="print-display flex items-center gap-2.5 text-2xl uppercase"
        >
          <span className="intro-mark flex">
            <Mark size={32} />
          </span>
          {/* One span a letter, so the opening can type the name out. */}
          <span aria-hidden className="flex">
            {[...NAME].map((letter, index) => (
              <span key={index} className="type-char" style={{ "--i": index } as CSSProperties}>
                {letter}
              </span>
            ))}
          </span>
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
        <Questions t={t} language={language} />
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

const NAME = "Stocktake";

/** A custom property for an inline style. */
const vars = (values: Record<`--${string}`, string | number>) => values as CSSProperties;

/**
 * A section's ledger entry number, above its heading. It types itself out: in the
 * opening for the hero's, as it scrolls into view for the rest.
 */
function Marker({ children, intro = false }: { children: string; intro?: boolean }) {
  return (
    <p
      aria-hidden
      data-reveal={intro ? undefined : ""}
      className={`ledger-marker ${intro ? "intro-marker" : "reveal-type"}`}
      style={vars({ "--chars": [...children].length })}
    >
      {children}
    </p>
  );
}

/** A heading or lede that rises into place after its entry number has typed out. */
const rise = (delay: number) => ({
  "data-reveal": "",
  className: "reveal-rise",
  style: vars({ "--reveal-delay": `${delay}ms` }),
});

/** The claim, the way in, and the proof under it: a write the database turned down. */
function Hero({ t, language }: Props) {
  return (
    <section className="pt-6 pb-20 lg:pt-10">
      <Marker intro>{t.markers.receipt}</Marker>
      <h1 className="print-display mt-4 text-[clamp(4rem,10vw,10rem)]">
        {t.headline.map((line, index) => (
          <span key={line} className="intro-line block" style={vars({ "--i": index })}>
            {line}
            {index < t.headline.length - 1 ? " " : null}
          </span>
        ))}
      </h1>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:mt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <p className="intro-lede max-w-[34rem] text-lg leading-relaxed text-ink-2">{t.lede}</p>
          <div className="intro-doors mt-8 max-w-md">
            <DemoDoors language={language} />
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{t.languages}</p>
          </div>
        </div>

        <div className="intro-card">
          <LiveRefusal language={language} />
        </div>
      </div>
    </section>
  );
}

/** Six writes someone might try, each with the database's own answer. */
function Refusals({ t, language }: Props) {
  return (
    <section aria-labelledby="refusals-title" className="py-12">
      <Marker>{t.markers.refusals}</Marker>
      <div {...rise(250)}>
        <h2 id="refusals-title" className="print-display mt-3 text-4xl sm:text-5xl">
          {t.breakIt}
        </h2>
      </div>
      <div {...rise(350)}>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{t.breakItLede}</p>
      </div>

      <RefusalRows language={language} />
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
        <div {...rise(250)}>
          <h2 id="ledger-title" className="print-display mt-3 text-4xl sm:text-5xl">
            {t.sum}
          </h2>
        </div>
        <div {...rise(350)}>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{t.sumLede}</p>
        </div>
      </div>

      <figure className="receipt torn-top ledger">
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
          {/* Each line prints as it scrolls into view, its balance a beat after it. Pointing
              at a line (or focusing it) shows what it did to the total. */}
          <tbody className="ledger-body">
            {LEDGER_ROWS.map((row) => (
              <tr key={row.day} data-ledger-row tabIndex={0} className="ledger-row border-b border-hairline">
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
                  {row.kind === "count" ? (
                    <span className="ledger-note mt-1 flex items-start gap-1 text-xs leading-snug font-semibold text-fault lang-bn:text-[0.8125rem]">
                      <CornerLeftUp aria-hidden size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                      {t.correctionNote}
                    </span>
                  ) : null}
                </td>
                <td className="ledger-units tabular py-2.5 pl-3 text-right">{f.change(row.quantity)}</td>
                <td className="ledger-balance py-2.5 pr-5 pl-3 sm:pr-6">
                  <span className="flex items-center justify-end gap-1.5">
                    <span aria-hidden className="ledger-connector" />
                    <span className="tabular font-semibold">{f.count(row.balance)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end justify-between gap-4 bg-ink px-5 pt-3 pb-4 text-label sm:px-6">
          <p className="text-sm font-semibold">{t.onHand}</p>
          <Odometer balances={LEDGER_ROWS.map((row) => row.balance)} language={language} />
        </div>
      </figure>
    </section>
  );
}

/**
 * The rest of the app: a real exchange with the assistant on its receipt, and a packing
 * list of what else the demo holds. The receipt sits on the left on a wide screen, so
 * the page doesn't print two sections in a row the same way round.
 */
function Questions({ t, language }: Props) {
  return (
    <section
      aria-labelledby="questions-title"
      className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start"
    >
      <div className="lg:order-last">
        <Marker>{t.markers.questions}</Marker>
        <div {...rise(250)}>
          <h2 id="questions-title" className="print-display mt-3 text-4xl sm:text-5xl">
            {t.shows}
          </h2>
        </div>
        <div {...rise(350)}>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{t.showsLede}</p>
        </div>
        <h3 className="field-name mt-10">{t.insideTitle}</h3>
        <ul className="mt-1 max-w-md border-t border-ink">
          {t.inside.map(([thing, what]) => (
            <li key={thing} className="border-b border-hairline py-2.5 leading-snug">
              <span className="font-semibold">{thing}</span>
              <span className="text-ink-2"> · {what}</span>
            </li>
          ))}
        </ul>
      </div>
      <AskReceipt language={language} />
    </section>
  );
}

/** The two seats in the demo, and the door to each: one ledger line across the page. */
function TwoWaysIn({ t, language }: Props) {
  return (
    <section aria-labelledby="ways-title" className="py-12">
      <Marker>{t.markers.access}</Marker>
      <div {...rise(250)}>
        <h2 id="ways-title" className="print-display mt-3 text-4xl sm:text-5xl">
          {t.twoWays}
        </h2>
      </div>
      <AccessRow language={language} />
      <p className="mt-6 max-w-2xl text-sm text-ink-2">{t.demoNote}</p>
      <ResetCountdown language={language} />
    </section>
  );
}
