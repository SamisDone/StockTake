import type { Copy } from "@/lib/i18n";

/** The Ask page's words, in both languages. Figures arrive already formatted. */

const en = {
  title: "Ask",
  starters: [
    "What's out of stock, and when can we get more?",
    "Which orders are late?",
    "What sold best over the last 28 days?",
    "Draft an order for the supplier with the most products running low.",
  ],
  limit: {
    questions: (cap: string) =>
      `You've asked all ${cap} of today's questions on this account. They come back at midnight; everything else works as usual.`,
    allowance: (time: string) =>
      `Today's free Workers AI allowance has run out. It's shared by everyone using this demo and comes back at ${time}, when Cloudflare resets it. Everything else works as usual.`,
  },
  problem: {
    failed: "The model didn't answer, so this question wasn't counted.",
    network: "The question didn't reach the server, so it wasn't counted. Check the connection.",
  },
  conversation: "Conversation",
  askQuestion: "Ask a question",
  question: "Question",
  placeholder: "What's running low at Harbor Packaging Co.?",
  followUp: "Ask a follow-up",
  ask: "Ask",
  charactersLeft: (n: string) => `${n} characters left · `,
  noneLeft: "No questions left today",
  left: (left: string, cap: string) => `${left} of ${cap} questions left today`,
  more: " · more at midnight",
  startOver: "Start over",
  lookingUp: "Looking it up…",
  answered: "Answered.",
  intro:
    "Ask about stock, orders, suppliers and sales in your own words. A language model answers by looking things up in the same records every page shows, and it can propose a purchase order for you to check and write.",
  introNote:
    "It only reads: it can't record stock or place orders. Every answer lists what it looked up. The model is GLM-4.7 Flash, running on Cloudflare Workers AI.",
  tryOne: "Try one",
  sessionEnded: ["Your session has ended. ", "Sign in again", " to ask."],
  notAnswered: (questions: boolean) =>
    `Not answered: ${questions ? "no questions left today." : "the day's allowance ran out."}`,
  askAgain: "Ask again",
  noLookups: "Answered without looking anything up.",
  howAnswered: (n: number, text: string) => `How this was answered: ${text} ${n === 1 ? "lookup" : "lookups"}`,
  notRun: (summary: string) => `Not run: ${summary}`,

  // A proposal
  proposal: {
    label: (supplier: string) => `Proposed order to ${supplier}`,
    title: "Proposed order",
    units: (n: number, text: string) => `${text} ${n === 1 ? "unit" : "units"} at today's costs`,
    product: "Product",
    quantity: "Quantity",
    cost: "Cost",
    onHand: (n: string) => ` · ${n} on hand`,
    total: "Total",
    written: ["Written as ", ", a draft."],
    write: "Write this draft",
    writeNote: "Nothing is written until you do. The draft opens so you can change it before it's placed.",
    writing: (supplier: string) => `Writing a draft to ${supplier}…`,
  },
};

export type AskCopy = typeof en;

const bn: AskCopy = {
  title: "জিজ্ঞাসা",
  starters: [
    "কী কী স্টক শেষ, আর কবে আবার পাওয়া যাবে?",
    "কোন অর্ডারগুলো দেরি করছে?",
    "গত ২৮ দিনে কী সবচেয়ে বেশি বিক্রি হয়েছে?",
    "যে সরবরাহকারীর সবচেয়ে বেশি পণ্য কমে আসছে, তার জন্য একটি অর্ডারের খসড়া করো।",
  ],
  limit: {
    questions: (cap) =>
      `এই অ্যাকাউন্টে আজকের ${cap}টি প্রশ্নই করা হয়ে গেছে। রাত ১২টায় আবার পাওয়া যাবে; বাকি সব আগের মতোই চলবে।`,
    allowance: (time) =>
      `আজকের বিনামূল্যের Workers AI বরাদ্দ শেষ। এই ডেমোর সবাই এটি ভাগাভাগি করেন, আর ${time}-এ Cloudflare এটি আবার চালু করলে পাওয়া যাবে। বাকি সব আগের মতোই চলবে।`,
  },
  problem: {
    failed: "মডেল উত্তর দেয়নি, তাই এই প্রশ্নটি গোনা হয়নি।",
    network: "প্রশ্নটি সার্ভারে পৌঁছায়নি, তাই গোনা হয়নি। সংযোগ দেখে নিন।",
  },
  conversation: "কথোপকথন",
  askQuestion: "প্রশ্ন করুন",
  question: "প্রশ্ন",
  placeholder: "Harbor Packaging Co.-এর কী কী কমে আসছে?",
  followUp: "পরের প্রশ্ন করুন",
  ask: "জিজ্ঞেস",
  charactersLeft: (n) => `আর ${n}টি অক্ষর · `,
  noneLeft: "আজ আর প্রশ্ন বাকি নেই",
  left: (left, cap) => `আজ ${cap}টির মধ্যে ${left}টি প্রশ্ন বাকি`,
  more: " · আরও পাবেন রাত ১২টায়",
  startOver: "নতুন করে শুরু",
  lookingUp: "খোঁজা হচ্ছে…",
  answered: "উত্তর এসেছে।",
  intro:
    "স্টক, অর্ডার, সরবরাহকারী আর বিক্রি নিয়ে নিজের ভাষায় জিজ্ঞেস করুন। একটি ভাষা মডেল প্রতিটি পাতায় দেখানো একই রেকর্ড ঘেঁটে উত্তর দেয়, আর আপনার যাচাই করে লেখার জন্য একটি ক্রয় অর্ডারের প্রস্তাবও দিতে পারে।",
  introNote:
    "এটি শুধু পড়ে: স্টক লিখতে বা অর্ডার দিতে পারে না। প্রতিটি উত্তরের সাথে থাকে কী কী দেখা হয়েছে। মডেলটি GLM-4.7 Flash, চলে Cloudflare Workers AI-তে।",
  tryOne: "একটি চেষ্টা করুন",
  sessionEnded: ["আপনার সেশন শেষ হয়ে গেছে। জিজ্ঞেস করতে ", "আবার সাইন ইন করুন", "।"],
  notAnswered: (questions) => `উত্তর দেওয়া হয়নি: ${questions ? "আজ আর প্রশ্ন বাকি নেই।" : "আজকের বরাদ্দ শেষ।"}`,
  askAgain: "আবার জিজ্ঞেস করুন",
  noLookups: "কিছু না দেখেই উত্তর দেওয়া হয়েছে।",
  howAnswered: (_n, text) => `যেভাবে উত্তর এল: ${text}টি খোঁজ`,
  notRun: () => "চালানো যায়নি",

  proposal: {
    label: (supplier) => `${supplier}-এর জন্য প্রস্তাবিত অর্ডার`,
    title: "প্রস্তাবিত অর্ডার",
    units: (_n, text) => `আজকের দামে ${text} ইউনিট`,
    product: "পণ্য",
    quantity: "পরিমাণ",
    cost: "খরচ",
    onHand: (n) => ` · মজুত ${n}`,
    total: "মোট",
    written: ["খসড়া হিসেবে লেখা হয়েছে: ", "।"],
    write: "এই খসড়াটি লিখুন",
    writeNote: "আপনি না লেখা পর্যন্ত কিছুই লেখা হয় না। খসড়াটি খুলবে, যাতে অর্ডার দেওয়ার আগে বদলাতে পারেন।",
    writing: (supplier) => `${supplier}-এর জন্য খসড়া লেখা হচ্ছে…`,
  },
};

export const ASK_COPY: Copy<AskCopy> = { en, bn };
