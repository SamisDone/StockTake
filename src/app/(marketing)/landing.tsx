import type { Metadata } from "next";
import Link from "next/link";
import { DemoDoors } from "@/components/demo-doors";
import { LanguageSwitch } from "@/components/language-switch";
import { Mark } from "@/components/logo";
import { DEMO_ROLES } from "@/lib/demo-roles";
import { formats } from "@/lib/format";
import { type Copy, LANGUAGE_TAGS, type Language } from "@/lib/i18n";
import { REFUSALS } from "@/lib/refusals";
import { parseDayKey } from "@/lib/business-time";

/**
 * The landing page, in either language. It's prerendered once per language (`/` and
 * `/bn`); proxy.ts serves the reader's from the language cookie, so neither reads the
 * request and both stay static.
 */

export function landingMetadata(language: Language): Metadata {
  const t = COPY[language];
  return { title: { absolute: t.metaTitle }, description: t.metaDescription };
}

const [headline] = REFUSALS;

export function Landing({ language }: { language: Language }) {
  const t = COPY[language];
  return (
    <div lang={LANGUAGE_TAGS[language]} className="mx-auto max-w-6xl px-4 sm:px-8">
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

/** The claim, the way in, and the proof beside it: a write the database turned down. */
function Hero({ t, language }: Props) {
  return (
    <section className="grid items-start gap-10 pt-8 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pt-16">
      <div>
        <h1 className="print-display text-[clamp(3.5rem,9vw,6rem)] text-balance">{t.headline}</h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">{t.lede}</p>
        <div className="mt-8 max-w-md">
          <DemoDoors language={language} />
        </div>
      </div>

      <figure className="sheet overflow-hidden lg:mt-4" aria-labelledby="slip-caption">
        <div className="border-b-2 border-ink px-6 pt-3 pb-4">
          <p className="field-name">{t.attempted}</p>
          <pre className="mt-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">{headline.sql}</pre>
        </div>
        <div className="bg-ink px-6 pt-3 pb-5 text-label">
          <p className="text-xs font-semibold text-liner">{t.answered}</p>
          <p className="mt-2 font-mono text-lg leading-snug font-semibold">{headline.refusal}</p>
        </div>
        <figcaption id="slip-caption" className="px-6 py-3 text-sm text-ink-2">
          {t.refusedCaption(headline.attempt[language])}
        </figcaption>
      </figure>
    </section>
  );
}

/** Six writes someone might try, each with the database's own answer. */
function Refusals({ t, language }: Props) {
  return (
    <section aria-labelledby="refusals-title" className="py-12">
      <h2 id="refusals-title" className="print-display text-4xl sm:text-5xl">
        {t.breakIt}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{t.breakItLede}</p>

      <ol className="sheet mt-8 overflow-hidden">
        {REFUSALS.map(({ attempt, sql, refusal }) => (
          <li
            key={sql}
            className="grid gap-x-8 gap-y-2 border-b border-hairline px-5 py-4 last:border-b-0 sm:px-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)] md:items-baseline"
          >
            <p className="font-semibold">{attempt[language]}</p>
            <code className="font-mono text-xs leading-relaxed break-words text-ink-2">{sql}</code>
            <p className="justify-self-start rounded-mark bg-ink px-2 py-1 font-mono text-xs leading-relaxed font-semibold text-label">
              {refusal}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-2xl text-sm text-ink-2">{t.breakItNote}</p>
    </section>
  );
}

type Kind = "receipt" | "sale" | "return" | "writeOff" | "count";

/** An example product's October, on the business's clock like every ledger date. */
const EXAMPLE_MOVEMENTS: { day: number; kind: Kind; detail: "order" | "crushed" | "found" | null; quantity: number }[] =
  [
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
        <h2 id="ledger-title" className="print-display text-4xl sm:text-5xl">
          {t.sum}
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{t.sumLede}</p>
      </div>

      <figure className="sheet overflow-hidden">
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
      <h2 id="ways-title" className="print-display text-4xl sm:text-5xl">
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
        <DemoDoors language={language} name={t.openAs} />
      </div>
      <p className="mt-6 max-w-2xl text-sm text-ink-2">{t.demoNote}</p>
    </section>
  );
}

const en = {
  metaTitle: "Stocktake: inventory you can audit",
  metaDescription:
    "Every unit on hand traces back to an entry in an append-only ledger, and the database refuses any write that would break that.",
  signIn: "Sign in",
  footer: ["Stocktake rebuilds ", ", a PHP and MySQL course project, on Next.js, Cloudflare Workers and D1."],
  headline: "Stock you can prove.",
  lede: "Stocktake records every receipt, sale, return and write-off in a ledger that only grows. The number on hand is that ledger's total, and the database refuses any write that would make the two disagree.",
  attempted: "Attempted write",
  answered: "The database answered",
  refusedCaption: (attempt: string) =>
    `${attempt}: refused, and nothing changed. On hand only moves when a movement is recorded.`,
  breakIt: "Try to break it.",
  breakItLede:
    "The rules live in the database, not just in the app, so no bug and no hand-written query can get around them. These are its answers, word for word.",
  breakItNote:
    "A test runs every statement above against the real migrations and fails if any answer changes, so this list can't drift from the database.",
  sum: "On hand is a sum.",
  sumLede:
    "Nobody types the number on hand. It is the last line of the product's ledger, and a mistake is fixed by adding a line, never by rewriting one. Ask why a count is what it is, and the answer is right there.",
  product: "Product",
  tape: "Packing tape, 48 mm",
  example: "Example",
  columns: { date: "Date", movement: "Movement", units: "Units", balance: "Balance" },
  kinds: { receipt: "Receipt", sale: "Sale", return: "Return", writeOff: "Write-off", count: "Count" } as Record<
    Kind,
    string
  >,
  details: { order: "PO-0012", crushed: "Crushed carton", found: "Found 40, expected 42" },
  onHand: "On hand",
  twoWays: "Two ways in.",
  work: {
    admin: "Runs the catalog and suppliers, reads days of cover and reorder suggestions, and places purchase orders.",
    staff: "Counts shelves, records sales, returns and write-offs, and receives deliveries against placed orders.",
  },
  openAs: "Open the demo as",
  demoNote:
    "The demo is a small distributor with six suppliers and four months of trading. Changes you make are real, and everyone sees them until the demo starts over at midnight, Dhaka time.",
};
type LandingCopy = typeof en;

const COPY: Copy<LandingCopy> = {
  en,
  bn: {
    metaTitle: "Stocktake: যে মজুতের হিসাব যাচাই করা যায়",
    metaDescription:
      "মজুতের প্রতিটি ইউনিট শুধু-যোগ-হয় এমন একটি খাতার এন্ট্রিতে গিয়ে মেলে, আর সেই নিয়ম ভাঙে এমন যেকোনো লেখা ডেটাবেস ফিরিয়ে দেয়।",
    signIn: "সাইন ইন",
    footer: [
      "Stocktake নতুন করে গড়েছে ",
      ", একটি PHP ও MySQL কোর্স প্রজেক্ট, Next.js, Cloudflare Workers ও D1-এর ওপর।",
    ],
    headline: "যে মজুত প্রমাণ করা যায়।",
    lede: "Stocktake প্রতিটি প্রাপ্তি, বিক্রি, ফেরত আর বাতিল এমন একটি খাতায় লেখে যা শুধু বাড়ে। মজুতের সংখ্যা সেই খাতারই যোগফল, আর দুটোর মধ্যে গরমিল ঘটায় এমন যেকোনো লেখা ডেটাবেস ফিরিয়ে দেয়।",
    attempted: "যা লেখার চেষ্টা হয়েছিল",
    answered: "ডেটাবেসের উত্তর",
    refusedCaption: (attempt) =>
      `${attempt}: ফিরিয়ে দেওয়া হয়েছে, কিছুই বদলায়নি। লেনদেন লেখা হলেই কেবল মজুত বদলায়।`,
    breakIt: "ভাঙার চেষ্টা করে দেখুন।",
    breakItLede:
      "নিয়মগুলো শুধু অ্যাপে নয়, ডেটাবেসেই আছে, তাই কোনো বাগ বা হাতে লেখা কোয়েরি এগুলো এড়াতে পারে না। নিচে তার উত্তরগুলো, হুবহু।",
    breakItNote:
      "একটি টেস্ট ওপরের প্রতিটি স্টেটমেন্ট আসল মাইগ্রেশনের ওপর চালায়, আর কোনো উত্তর বদলালেই ব্যর্থ হয়, তাই এই তালিকা ডেটাবেস থেকে সরে যেতে পারে না।",
    sum: "মজুত একটি যোগফল।",
    sumLede:
      "মজুতের সংখ্যা কেউ হাতে লেখে না। এটি পণ্যের খাতার শেষ লাইন, আর ভুল শোধরানো হয় নতুন লাইন যোগ করে, কখনো পুরোনো লাইন বদলে নয়। কোনো গণনা কেন এমন, জানতে চাইলে উত্তর সেখানেই আছে।",
    product: "পণ্য",
    tape: "প্যাকিং টেপ, ৪৮ মিমি",
    example: "উদাহরণ",
    columns: { date: "তারিখ", movement: "লেনদেন", units: "ইউনিট", balance: "ব্যালান্স" },
    kinds: { receipt: "প্রাপ্তি", sale: "বিক্রি", return: "ফেরত", writeOff: "বাতিল", count: "গণনা" },
    details: { order: "PO-0012", crushed: "কার্টন চ্যাপ্টা", found: "পাওয়া গেছে ৪০, থাকার কথা ৪২" },
    onHand: "মজুত",
    twoWays: "ঢোকার দুটি পথ।",
    work: {
      admin: "পণ্যতালিকা ও সরবরাহকারী সামলান, মজুত কত দিন চলবে আর পুনঃঅর্ডারের প্রস্তাব দেখেন, আর ক্রয় অর্ডার দেন।",
      staff: "তাকের মাল গোনেন, বিক্রি, ফেরত ও বাতিল লেখেন, আর দেওয়া অর্ডারের ডেলিভারি বুঝে নেন।",
    },
    openAs: "ডেমো খুলুন যে হিসেবে",
    demoNote:
      "ডেমোটি ছয় সরবরাহকারী আর চার মাসের কেনাবেচার একটি ছোট পরিবেশক। আপনি যা বদলাবেন, তা সত্যিই বদলাবে, আর ঢাকার সময় রাত ১২টায় ডেমো নতুন করে শুরু হওয়া পর্যন্ত সবাই তা দেখবে।",
  },
};
