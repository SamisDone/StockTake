import type { Copy } from "@/lib/i18n";

/**
 * The landing page's words, in both languages. A plain module, so the server-rendered
 * page and its client parts (the live statement, the refusal rows, the countdown) read
 * the same copy. The refusals themselves are not here: they're the database's own text,
 * in `src/lib/refusals.ts`, checked by its test.
 */

export type MovementKind = "receipt" | "sale" | "return" | "writeOff" | "count";

const en = {
  metaTitle: "Stocktake: inventory you can audit",
  metaDescription:
    "Every unit on hand traces back to an entry in an append-only ledger, and the database refuses any write that would break that.",
  signIn: "Sign in",
  footer: ["Stocktake rebuilds ", ", a PHP and MySQL course project, on Next.js, Cloudflare Workers and D1."],
  /** Ledger entry numbers above each section's heading. */
  markers: {
    receipt: "01 · Receipt",
    refusals: "02 · Refusals",
    balance: "03 · Balance",
    questions: "04 · Questions",
    access: "05 · Access",
  },
  /** The headline, one entry per printed line. */
  headline: ["Stock you", "can prove."],
  lede: "Stocktake records every receipt, sale, return and write-off in a ledger that only grows. The number on hand is that ledger's total, and the database refuses any write that would make the two disagree.",

  attempted: "Attempted write",
  answered: "The database answered",
  willAnswer: "The database will answer",
  inputLabel: "Number to write into on_hand for WID-001",
  run: "Run",
  ready: "Change the number, then press Run.",
  /** The caption before anyone has run it: the answer is already printed above. */
  tryYourOwn: (n: string) => `Refused. Nothing changed. Try your own number: change ${n}, then press Run.`,
  sending: "Sending…",
  refused: "Refused. Nothing changed.",
  stillOnHand: (onHand: string) => `On hand is still ${onHand}.`,
  hintNumber: "Whole numbers only, like 500.",
  hintSame: (onHand: string) =>
    `${onHand} is what the ledger already says, so there's nothing to refuse. Try another number.`,

  breakIt: "Try to break it.",
  breakItLede:
    "The rules live in the database, not just in the app, so no bug and no hand-written query can get around them. These are its answers, word for word.",
  runAgain: "Run again",
  runAgainLabel: (n: string) => `Run statement ${n} again`,
  /** On a phone, under the first three rows. */
  showRest: (n: string) => `Show the other ${n}`,
  breakItNote:
    "A test runs every statement above against the real migrations and fails if any answer changes, so this list can't drift from the database.",

  sum: "On hand is a sum.",
  sumLede:
    "Nobody types the number on hand. It is the last line of the product's ledger, and a mistake is fixed by adding a line, never by rewriting one. Ask why a count is what it is, and the answer is right there.",
  product: "Product",
  tape: "Packing tape, 48 mm",
  example: "Example",
  columns: { date: "Date", movement: "Movement", units: "Units", balance: "Balance" },
  kinds: {
    receipt: "Receipt",
    sale: "Sale",
    return: "Return",
    writeOff: "Write-off",
    count: "Count",
  } as Record<MovementKind, string>,
  details: { order: "PO-0012", crushed: "Crushed carton", found: "Found 40, expected 42" },
  correctionNote: "A correction is a new line. Nothing above it was edited.",
  onHand: "On hand",

  shows: "It shows its working.",
  showsLede:
    "Ask the assistant about stock, orders, suppliers or sales in plain words. It answers from the same records through a few read-only lookups and lists each one under its answer. It can't write anything: an order it suggests stays a proposal until a person writes it as a draft.",
  /** What else the demo holds, one line each: the thing, then what it does. */
  insideTitle: "Also inside",
  inside: [
    ["Reorder suggestions", "from days of cover, grouped by supplier"],
    ["Purchase orders", "drafted, placed, received in part, sent back"],
    ["Sales", "with discounts, customers and what each one owes"],
    ["Analytics", "that reconcile to the ledger"],
    ["CSV in and out", "and purchase orders ready to print"],
    ["Bangla or English", "with money in taka or dollars"],
  ] as [string, string][],
  exchange: {
    question: "Question",
    asked: (day: string) => `Example, asked ${day}`,
    inEnglish: null as string | null,
    lookups: "Lookups",
    answer: "Answer",
    proposed: "Proposed order",
    onHand: (n: string) => `${n} on hand`,
    total: "Total",
    handover: "Nothing is written until a person presses Write this draft.",
  },

  twoWays: "Two ways in.",
  work: {
    admin: "Runs the catalog and suppliers, reads days of cover and reorder suggestions, and places purchase orders.",
    staff: "Counts shelves, records sales, returns and write-offs, and receives deliveries against placed orders.",
  },
  openAs: "Open the demo as",
  demoNote:
    "The demo is a small distributor with six suppliers and four months of trading. Changes you make are real, and everyone sees them until the demo starts over at midnight, Dhaka time.",
  resetsIn: "Starts over in",
};

export type LandingCopy = typeof en;

export const COPY: Copy<LandingCopy> = {
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
    markers: {
      receipt: "০১ · রসিদ",
      refusals: "০২ · প্রত্যাখ্যান",
      balance: "০৩ · ব্যালান্স",
      questions: "০৪ · প্রশ্ন",
      access: "০৫ · প্রবেশ",
    },
    headline: ["যে মজুত", "প্রমাণ করা যায়।"],
    lede: "Stocktake প্রতিটি প্রাপ্তি, বিক্রি, ফেরত আর বাতিল এমন একটি খাতায় লেখে যা শুধু বাড়ে। মজুতের সংখ্যা সেই খাতারই যোগফল, আর দুটোর মধ্যে গরমিল ঘটায় এমন যেকোনো লেখা ডেটাবেস ফিরিয়ে দেয়।",

    attempted: "যা লেখার চেষ্টা হয়েছিল",
    answered: "ডেটাবেসের উত্তর",
    willAnswer: "ডেটাবেস উত্তর দেবে",
    inputLabel: "WID-001-এর on_hand-এ যে সংখ্যা লেখা হবে",
    run: "চালান",
    ready: "সংখ্যাটা বদলে “চালান” চাপুন।",
    tryYourOwn: (n) => `ফিরিয়ে দেওয়া হয়েছে। কিছুই বদলায়নি। নিজের একটি সংখ্যা দিয়ে দেখুন: ${n} বদলে “চালান” চাপুন।`,
    sending: "পাঠানো হচ্ছে…",
    refused: "ফিরিয়ে দেওয়া হয়েছে। কিছুই বদলায়নি।",
    stillOnHand: (onHand) => `মজুত এখনো ${onHand}।`,
    hintNumber: "শুধু পূর্ণ সংখ্যা, যেমন ৫০০।",
    hintSame: (onHand) => `খাতাতেও ${onHand}, তাই ফেরানোর কিছু নেই। অন্য একটি সংখ্যা দিয়ে দেখুন।`,

    breakIt: "ভাঙার চেষ্টা করে দেখুন।",
    breakItLede:
      "নিয়মগুলো শুধু অ্যাপে নয়, ডেটাবেসেই আছে, তাই কোনো বাগ বা হাতে লেখা কোয়েরি এগুলো এড়াতে পারে না। নিচে তার উত্তরগুলো, হুবহু।",
    runAgain: "আবার চালান",
    runAgainLabel: (n) => `${n} নম্বর স্টেটমেন্ট আবার চালান`,
    showRest: (n) => `বাকি ${n}টি দেখুন`,
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
    correctionNote: "সংশোধন মানে নতুন একটি লাইন। ওপরের কিছুই বদলানো হয়নি।",
    onHand: "মজুত",

    shows: "কীভাবে উত্তর এল, তাও দেখায়।",
    showsLede:
      "মজুত, অর্ডার, সরবরাহকারী বা বিক্রি নিয়ে সহকারীকে সাধারণ ভাষায় জিজ্ঞেস করুন। সে একই রেকর্ড থেকে কয়েকটি শুধু-পড়া খোঁজ চালিয়ে উত্তর দেয়, আর প্রতিটি খোঁজ উত্তরের নিচে দেখায়। সে নিজে কিছুই লিখতে পারে না: তার প্রস্তাবিত অর্ডার প্রস্তাবই থাকে, যতক্ষণ না কেউ সেটি খসড়া হিসেবে লেখেন।",
    insideTitle: "ভেতরে আরও",
    inside: [
      ["পুনঃঅর্ডারের প্রস্তাব", "মজুত কত দিন চলবে তা থেকে, সরবরাহকারী ধরে"],
      ["ক্রয় অর্ডার", "খসড়া, দেওয়া, আংশিক বুঝে নেওয়া, ফেরত পাঠানো"],
      ["বিক্রি", "ছাড়, গ্রাহক আর কার কাছে কত পাওনা সহ"],
      ["বিশ্লেষণ", "যা খাতার সঙ্গে মিলিয়ে দেখা"],
      ["CSV আনা-নেওয়া", "আর ছাপার উপযোগী ক্রয় অর্ডার"],
      ["বাংলা বা ইংরেজি", "টাকা বা ডলারে হিসাব"],
    ],
    exchange: {
      question: "প্রশ্ন",
      asked: (day) => `উদাহরণ, ${day} জিজ্ঞাসা`,
      inEnglish: "প্রশ্ন আর উত্তর ইংরেজিতে, যেমন হয়েছিল।",
      lookups: "খোঁজ",
      answer: "উত্তর",
      proposed: "প্রস্তাবিত অর্ডার",
      onHand: (n) => `মজুত ${n}`,
      total: "মোট",
      handover: "কেউ “এই খসড়াটি লিখুন” না চাপা পর্যন্ত কিছুই লেখা হয় না।",
    },

    twoWays: "ঢোকার দুটি পথ।",
    work: {
      admin: "পণ্যতালিকা ও সরবরাহকারী সামলান, মজুত কত দিন চলবে আর পুনঃঅর্ডারের প্রস্তাব দেখেন, আর ক্রয় অর্ডার দেন।",
      staff: "তাকের মাল গোনেন, বিক্রি, ফেরত ও বাতিল লেখেন, আর দেওয়া অর্ডারের ডেলিভারি বুঝে নেন।",
    },
    // A no-break space keeps "যে হিসেবে" (as) together when the line wraps.
    openAs: "ডেমো খুলুন যে\u00a0হিসেবে",
    demoNote:
      "ডেমোটি ছয় সরবরাহকারী আর চার মাসের কেনাবেচার একটি ছোট পরিবেশক। আপনি যা বদলাবেন, তা সত্যিই বদলাবে, আর ঢাকার সময় রাত ১২টায় ডেমো নতুন করে শুরু হওয়া পর্যন্ত সবাই তা দেখবে।",
    resetsIn: "ডেমো আবার শুরু হতে বাকি",
  },
};
