import type { Copy } from "@/lib/i18n";

/** The analytics page's words, in both languages. Figures arrive already formatted. */

const en = {
  title: "Analytics",
  period: "Period",
  lastDays: (n: string) => `Last ${n} days`,
  toToday: (day: string) => `${day} to today · days are UTC`,
  tallies: ["Sales", "Gross margin", "Stock at cost", "Lost stock"],
  atList: (units: string) => `${units} units at list price`,
  ofSales: (percent: string) => `${percent}% of sales`,
  noSales: "No sales",
  unitsOnHand: (units: string) => `${units} units on hand`,
  lostNote: (writtenOff: string, net: string, over: boolean) =>
    `${writtenOff} written off, ${net} net ${over ? "over" : "short"} in counts`,

  // The statement
  statement: "Stock, from the ledger",
  statementNote: (from: string, taka: boolean) =>
    `What was on the shelves on ${from}, plus every movement the ledger recorded since, is what's on hand now. Money is at today's unit costs${taka ? " and today's taka rate" : ""}.`,
  startsInside: (day: string) => ` The ledger starts on ${day}, inside this period, so it opens at zero.`,
  movement: "Movement",
  units: "Units",
  atCost: "At cost",
  runningTotal: "Running total",
  opening: (day: string) => `Opening stock, ${day}`,
  lines: {
    received: "Received",
    returned: "Returned",
    sold: "Sold",
    writtenOff: "Written off",
    found: "Found in counts",
    short: "Short in counts",
  },
  onHandNow: "On hand now",
  agrees: "Matches the on-hand count of every product, which the database keeps equal to the ledger.",
  disagrees: (ledger: string, products: string) =>
    `The ledger adds up to ${ledger} units, but the products' on-hand counts add up to ${products}.`,

  // Sales by day
  sales: "Sales by day",
  salesNote:
    "Units sold less returns, at today's list prices: the ledger records units, not the price a sale was made at.",
  table: "Every day as a table",
  day: "Day",
  salesColumn: "Sales",
  todaySoFar: "Today so far",
  nothingSold: (days: string) => `Nothing sold in the last ${days} days.`,

  // By category
  categories: "By category",
  categoriesNote: "Lasts is how long a category's stock would last at this period's cost of sales.",
  category: "Category",
  grossMargin: "Gross margin",
  stockAtCost: "Stock at cost",
  lasts: "Lasts",
  products: (n: number, text: string) => `${text} ${n === 1 ? "product" : "products"}`,
  uncategorised: "Uncategorised",

  // Product lists
  best: "Best sellers",
  bestNote: "By sales at list price, net of returns.",
  bestEmpty: "Nothing sold in this period.",
  unitsSold: (n: string) => `${n} units`,
  slowest: "Slowest to sell",
  slowestNote: "Active products whose stock lasts longest at this period's sales.",
  slowestEmpty: "No active product has stock.",
  onHandValue: (units: string, value: string) => `${units} on hand · ${value}`,

  // The chart
  chart: {
    average: "Average full day",
    todaySoFar: "Today so far",
    today: "Today",
    units: (n: number, text: string) => `${text} ${n === 1 ? "unit" : "units"}`,
    label: "Sales by day. Use the arrow keys to read each day.",
  },
};

export type AnalyticsCopy = typeof en;

const bn: AnalyticsCopy = {
  title: "বিশ্লেষণ",
  period: "সময়কাল",
  lastDays: (n) => `গত ${n} দিন`,
  toToday: (day) => `${day} থেকে আজ · দিন UTC অনুযায়ী`,
  tallies: ["বিক্রি", "মোট লাভ", "কেনা দামে মজুত", "হারানো মজুত"],
  atList: (units) => `তালিকা দামে ${units} ইউনিট`,
  ofSales: (percent) => `বিক্রির ${percent}%`,
  noSales: "বিক্রি নেই",
  unitsOnHand: (units) => `মজুত ${units} ইউনিট`,
  lostNote: (writtenOff, net, over) => `${writtenOff}টি বাতিল, গণনায় নিট ${net}টি ${over ? "বেশি" : "কম"}`,

  statement: "খাতা থেকে মজুত",
  statementNote: (from, taka) =>
    `${from} তারিখে তাকে যা ছিল, তার সাথে খাতায় এরপর লেখা প্রতিটি লেনদেন মেলালে এখনকার মজুত পাওয়া যায়। টাকার হিসাব আজকের একক কেনা দামে${taka ? " ও আজকের টাকার হারে" : ""}।`,
  startsInside: (day) => ` খাতা শুরু হয়েছে ${day}, এই সময়কালের ভেতরে, তাই শুরু শূন্য থেকে।`,
  movement: "লেনদেন",
  units: "ইউনিট",
  atCost: "কেনা দামে",
  runningTotal: "চলতি যোগফল",
  opening: (day) => `শুরুর মজুত, ${day}`,
  lines: {
    received: "এসেছে",
    returned: "ফেরত এসেছে",
    sold: "বিক্রি",
    writtenOff: "বাতিল",
    found: "গণনায় বেশি পাওয়া",
    short: "গণনায় কম পাওয়া",
  },
  onHandNow: "এখনকার মজুত",
  agrees: "প্রতিটি পণ্যের মজুতের সাথে মিলে গেছে, যা ডেটাবেস খাতার সমান রাখে।",
  disagrees: (ledger, products) => `খাতার যোগফল ${ledger} ইউনিট, কিন্তু পণ্যগুলোর মজুত মিলিয়ে ${products}।`,

  sales: "দিনভিত্তিক বিক্রি",
  salesNote: "বিক্রি থেকে ফেরত বাদ দিয়ে, আজকের তালিকা দামে: খাতায় ইউনিট লেখা থাকে, কোন দামে বিক্রি হয়েছিল তা নয়।",
  table: "প্রতিদিনের হিসাব সারণিতে",
  day: "দিন",
  salesColumn: "বিক্রি",
  todaySoFar: "আজ এখন পর্যন্ত",
  nothingSold: (days) => `গত ${days} দিনে কিছু বিক্রি হয়নি।`,

  categories: "শ্রেণি অনুযায়ী",
  categoriesNote: "চলবে মানে এই সময়কালের বিক্রির খরচের হারে শ্রেণিটির মজুত কত দিন টিকবে।",
  category: "শ্রেণি",
  grossMargin: "মোট লাভ",
  stockAtCost: "কেনা দামে মজুত",
  lasts: "চলবে",
  products: (_n, text) => `${text}টি পণ্য`,
  uncategorised: "শ্রেণিহীন",

  best: "সবচেয়ে বেশি বিক্রি",
  bestNote: "তালিকা দামে বিক্রি অনুযায়ী, ফেরত বাদে।",
  bestEmpty: "এই সময়কালে কিছু বিক্রি হয়নি।",
  unitsSold: (n) => `${n} ইউনিট`,
  slowest: "সবচেয়ে ধীরে বিক্রি",
  slowestNote: "এই সময়কালের বিক্রির হারে যেসব চালু পণ্যের মজুত সবচেয়ে বেশি দিন টিকবে।",
  slowestEmpty: "কোনো চালু পণ্যের মজুত নেই।",
  onHandValue: (units, value) => `মজুত ${units} · ${value}`,

  chart: {
    average: "পূর্ণ দিনের গড়",
    todaySoFar: "আজ এখন পর্যন্ত",
    today: "আজ",
    units: (_n, text) => `${text} ইউনিট`,
    label: "দিনভিত্তিক বিক্রি। প্রতিটি দিন পড়তে তীর-কী ব্যবহার করুন।",
  },
};

export const ANALYTICS_COPY: Copy<AnalyticsCopy> = { en, bn };
