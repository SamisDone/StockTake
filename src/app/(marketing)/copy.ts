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
  markers: { receipt: "01 · Receipt", refusals: "02 · Refusals", balance: "03 · Balance", access: "04 · Access" },
  /** The headline, one entry per printed line. */
  headline: ["Stock you", "can prove."],
  lede: "Stocktake records every receipt, sale, return and write-off in a ledger that only grows. The number on hand is that ledger's total, and the database refuses any write that would make the two disagree.",

  attempted: "Attempted write",
  answered: "The database answered",
  willAnswer: "The database will answer",
  inputLabel: "Number to write into on_hand for WID-001",
  run: "Run",
  ready: "Change the number, then press Enter.",
  sending: "Sending…",
  refused: "Refused. Nothing changed.",
  stillOnHand: (onHand: string) => `On hand is still ${onHand}.`,
  attemptRefused: (attempt: string) => `${attempt}: refused. Nothing changed.`,
  hintNumber: "Whole numbers only, like 500.",
  hintSame: (onHand: string) =>
    `${onHand} is what the ledger already says, so there's nothing to refuse. Try another number.`,
  /** Which of the six the card is playing, read beside the field name. */
  playing: (n: string, total: string) => `${n} of ${total}`,

  breakIt: "Try to break it.",
  breakItLede:
    "The rules live in the database, not just in the app, so no bug and no hand-written query can get around them. These are its answers, word for word.",
  runAgain: "Run again",
  runAgainLabel: (n: string) => `Run statement ${n} again`,
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

  twoWays: "Two ways in.",
  work: {
    admin: "Runs the catalog and suppliers, reads days of cover and reorder suggestions, and places purchase orders.",
    staff: "Counts shelves, records sales, returns and write-offs, and receives deliveries against placed orders.",
  },
  openAs: "Open the demo as",
  demoNote:
    "The demo is a small distributor with six suppliers and four months of trading. Changes you make are real, and everyone sees them until the demo starts over at midnight, Dhaka time.",
  resetsIn: "Demo resets in",
  dhaka: "Dhaka",
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
    markers: { receipt: "০১ · রসিদ", refusals: "০২ · প্রত্যাখ্যান", balance: "০৩ · ব্যালান্স", access: "০৪ · প্রবেশ" },
    headline: ["যে মজুত", "প্রমাণ করা যায়।"],
    lede: "Stocktake প্রতিটি প্রাপ্তি, বিক্রি, ফেরত আর বাতিল এমন একটি খাতায় লেখে যা শুধু বাড়ে। মজুতের সংখ্যা সেই খাতারই যোগফল, আর দুটোর মধ্যে গরমিল ঘটায় এমন যেকোনো লেখা ডেটাবেস ফিরিয়ে দেয়।",

    attempted: "যা লেখার চেষ্টা হয়েছিল",
    answered: "ডেটাবেসের উত্তর",
    willAnswer: "ডেটাবেস উত্তর দেবে",
    inputLabel: "WID-001-এর on_hand-এ যে সংখ্যা লেখা হবে",
    run: "চালান",
    ready: "সংখ্যাটা বদলে Enter চাপুন।",
    sending: "পাঠানো হচ্ছে…",
    refused: "ফিরিয়ে দেওয়া হয়েছে। কিছুই বদলায়নি।",
    stillOnHand: (onHand) => `মজুত এখনো ${onHand}।`,
    attemptRefused: (attempt) => `${attempt}: ফিরিয়ে দেওয়া হয়েছে। কিছুই বদলায়নি।`,
    hintNumber: "শুধু পূর্ণ সংখ্যা, যেমন ৫০০।",
    hintSame: (onHand) => `খাতাতেও ${onHand}, তাই ফেরানোর কিছু নেই। অন্য একটি সংখ্যা দিয়ে দেখুন।`,
    playing: (n, total) => `${total}টির ${n} নম্বর`,

    breakIt: "ভাঙার চেষ্টা করে দেখুন।",
    breakItLede:
      "নিয়মগুলো শুধু অ্যাপে নয়, ডেটাবেসেই আছে, তাই কোনো বাগ বা হাতে লেখা কোয়েরি এগুলো এড়াতে পারে না। নিচে তার উত্তরগুলো, হুবহু।",
    runAgain: "আবার চালান",
    runAgainLabel: (n) => `${n} নম্বর স্টেটমেন্ট আবার চালান`,
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

    twoWays: "ঢোকার দুটি পথ।",
    work: {
      admin: "পণ্যতালিকা ও সরবরাহকারী সামলান, মজুত কত দিন চলবে আর পুনঃঅর্ডারের প্রস্তাব দেখেন, আর ক্রয় অর্ডার দেন।",
      staff: "তাকের মাল গোনেন, বিক্রি, ফেরত ও বাতিল লেখেন, আর দেওয়া অর্ডারের ডেলিভারি বুঝে নেন।",
    },
    openAs: "ডেমো খুলুন যে হিসেবে",
    demoNote:
      "ডেমোটি ছয় সরবরাহকারী আর চার মাসের কেনাবেচার একটি ছোট পরিবেশক। আপনি যা বদলাবেন, তা সত্যিই বদলাবে, আর ঢাকার সময় রাত ১২টায় ডেমো নতুন করে শুরু হওয়া পর্যন্ত সবাই তা দেখবে।",
    resetsIn: "ডেমো আবার শুরু হতে বাকি",
    dhaka: "ঢাকা",
  },
};
