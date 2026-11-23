import { formats } from "@/lib/format";
import type { Copy } from "@/lib/i18n";

/** What Server Actions say back to a form, in both languages. */

const en = {
  noProduct: "That product doesn't exist.",
  noSupplier: "That supplier doesn't exist.",
  noOrder: "That purchase order doesn't exist.",

  // Signing in
  enterEmail: "Enter your email address.",
  enterPassword: "Enter your password.",
  noDemo: "The demo account isn't set up on this database. Run the demo seed first.",
  wrongPassword: "That email and password don't match an account. Check the password, or use a demo account above.",

  // Stock
  chooseKind: "Choose what you're recording.",
  enterCount: "Enter the number you counted on the shelf, as a whole number.",
  enterUnits: (max: number) => `Enter how many units, as a whole number from 1 to ${formats("en").count(max)}.`,
  countMatches: (name: string, counted: number) => `Counted ${formats("en").count(counted)} × ${name}, which matches.`,
  countAdjusted: (name: string, counted: number, difference: number) =>
    `Counted ${formats("en").count(counted)} × ${name}, so the ledger was adjusted by ${formats("en").change(difference)}.`,
  recorded: (name: string, kind: "sale" | "return" | "write_off", quantity: number, onHand: number) =>
    `Recorded ${{ sale: "a sale", return: "a return", write_off: "a write-off" }[kind]} of ${formats("en").count(quantity)} × ${name}. ${formats("en").count(onHand)} on hand.`,
  undone: (name: string, onHand: number) => `Undone. ${formats("en").count(onHand)} × ${name} on hand.`,

  // People
  roleChanged: (name: string, role: "admin" | "staff") => `${name} is ${role === "admin" ? "an admin" : "staff"} now.`,
  passwordChanged: "Changed your password. You're still signed in here; anywhere else signs in again.",

  // Orders
  chooseIntent: "Choose what to do with the order.",
  placed: (order: string, supplier: string) => `Placed ${order} with ${supplier}.`,
  cancelled: (order: string) => `Cancelled ${order}.`,
  received: (order: string, units: number) =>
    `Received ${order}: ${formats("en").count(units)} units booked into stock.`,
  receivedPart: (order: string, units: number) =>
    `Received part of ${order}: ${formats("en").count(units)} units booked into stock. The rest is still due.`,
  closedShort: (order: string, short: number) =>
    `Closed ${order} short: ${formats("en").count(short)} units won't come.`,
  sentBack: (name: string, quantity: number, order: string) =>
    `Sent ${formats("en").count(quantity)} × ${name} back on ${order}.`,
  wholeUnits: "Enter whole units, 0 or more.",
  chooseSupplier: "Choose who the order is for.",
  orderAtLeastOne: "Order 1 unit or more.",
  orderAtMost: (max: number) => `Order ${formats("en").count(max)} units or fewer.`,
  enterCost: "Enter the cost in dollars and cents, like 4.50.",
  costTooLarge: "That cost is more than an order can take.",
  enterDate: "Enter a date, or leave it empty.",
  addProduct: "Add at least one product.",
  proposalStale: "A line of the proposal isn't valid any more. Ask again for a new one.",
  proposalEmpty: "The proposal has no lines.",

  // Catalog
  enterMoney: (what: "cost" | "price") => `Enter the ${what} in dollars and cents, like 4.50.`,
  enterUnitsZero: "Enter a whole number of units, 0 or more.",
  enterSku: "Enter a SKU.",
  enterDays: "Enter a whole number of days, 0 or more.",
  chooseStars: "Choose 1 to 5 stars.",
  reviewSaved: "Saved your review.",
  reviewRemoved: "Removed your review.",

  // Sales and customers
  noSale: "That sale doesn't exist.",
  noCustomer: "That customer doesn't exist.",
  sellAtLeastOne: "Sell 1 unit or more.",
  enterPrice: "Enter the price in dollars and cents, like 4.50.",
  enterDiscount: "Enter the discount in dollars and cents, or leave it empty.",
  enterPaid: "Enter what was paid in dollars and cents, 0 or more.",
  enterAmount: "Enter the amount in dollars and cents, like 20.00.",
  choosePayment: "Choose how it was paid.",
};

const b = formats("bn");

const bn: typeof en = {
  noProduct: "এই পণ্যটি নেই।",
  noSupplier: "এই সরবরাহকারী নেই।",
  noOrder: "এই ক্রয় অর্ডারটি নেই।",

  enterEmail: "আপনার ইমেইল ঠিকানা লিখুন।",
  enterPassword: "আপনার পাসওয়ার্ড লিখুন।",
  noDemo: "এই ডেটাবেসে ডেমো অ্যাকাউন্ট তৈরি হয়নি। আগে ডেমো সিড চালান।",
  wrongPassword:
    "এই ইমেইল ও পাসওয়ার্ডে কোনো অ্যাকাউন্ট মেলেনি। পাসওয়ার্ড আবার দেখুন, অথবা ওপরের ডেমো অ্যাকাউন্ট ব্যবহার করুন।",

  chooseKind: "কী লিখে রাখছেন, বেছে নিন।",
  enterCount: "তাকে যত গুনেছেন, সেই সংখ্যাটি পূর্ণসংখ্যায় লিখুন।",
  enterUnits: (max) => `কত ইউনিট, ১ থেকে ${b.count(max)}-এর মধ্যে পূর্ণসংখ্যায় লিখুন।`,
  countMatches: (name, counted) => `${name} গোনা হলো ${b.count(counted)}, হিসাবের সাথে মিলে গেছে।`,
  countAdjusted: (name, counted, difference) =>
    `${name} গোনা হলো ${b.count(counted)}, তাই খাতায় ${b.change(difference)} সমন্বয় করা হয়েছে।`,
  recorded: (name, kind, quantity, onHand) =>
    `${b.count(quantity)} × ${name} ${{ sale: "বিক্রি", return: "ফেরত", write_off: "বাতিল" }[kind]} লেখা হলো। মজুত এখন ${b.count(onHand)}।`,
  undone: (name, onHand) => `ফিরিয়ে নেওয়া হলো। ${name} মজুত এখন ${b.count(onHand)}।`,

  roleChanged: (name, role) => `${name} এখন ${role === "admin" ? "অ্যাডমিন" : "কর্মী"}।`,
  passwordChanged: "পাসওয়ার্ড বদলানো হলো। এখানে সাইন ইন থাকছেন; অন্য কোথাও আবার সাইন ইন করতে হবে।",

  chooseIntent: "অর্ডারটি নিয়ে কী করবেন, বেছে নিন।",
  placed: (order, supplier) => `${supplier}-কে ${order} দেওয়া হলো।`,
  cancelled: (order) => `${order} বাতিল হলো।`,
  received: (order, units) => `${order} বুঝে নেওয়া হলো: ${b.count(units)} ইউনিট মজুতে যোগ হয়েছে।`,
  receivedPart: (order, units) =>
    `${order}-এর কিছু অংশ বুঝে নেওয়া হলো: ${b.count(units)} ইউনিট মজুতে যোগ হয়েছে। বাকিটা এখনো আসার কথা।`,
  closedShort: (order, short) => `${order} কম নিয়ে বন্ধ হলো: ${b.count(short)} ইউনিট আর আসবে না।`,
  sentBack: (name, quantity, order) => `${order}-এর ${b.count(quantity)} × ${name} ফেরত পাঠানো হলো।`,
  wholeUnits: "০ বা তার বেশি পূর্ণ সংখ্যা লিখুন।",
  chooseSupplier: "অর্ডারটি কার জন্য, বেছে নিন।",
  orderAtLeastOne: "অন্তত ১ ইউনিট অর্ডার করুন।",
  orderAtMost: (max) => `${b.count(max)} ইউনিট বা তার কম অর্ডার করুন।`,
  enterCost: "খরচ ডলার ও সেন্টে লিখুন, যেমন ৪.৫০।",
  costTooLarge: "এই খরচ একটি অর্ডারের সীমার চেয়ে বেশি।",
  enterDate: "একটি তারিখ দিন, অথবা খালি রাখুন।",
  addProduct: "অন্তত একটি পণ্য যোগ করুন।",
  proposalStale: "প্রস্তাবের একটি লাইন আর বৈধ নেই। নতুন প্রস্তাবের জন্য আবার জিজ্ঞেস করুন।",
  proposalEmpty: "প্রস্তাবে কোনো লাইন নেই।",

  enterMoney: (what) => `${what === "cost" ? "কেনা দাম" : "বিক্রয় মূল্য"} ডলার ও সেন্টে লিখুন, যেমন ৪.৫০।`,
  enterUnitsZero: "ইউনিটের সংখ্যা পূর্ণসংখ্যায় লিখুন, ০ বা তার বেশি।",
  enterSku: "একটি SKU লিখুন।",
  enterDays: "দিনের সংখ্যা পূর্ণসংখ্যায় লিখুন, ০ বা তার বেশি।",
  chooseStars: "১ থেকে ৫ তারা বেছে নিন।",
  reviewSaved: "আপনার রিভিউ সংরক্ষণ হলো।",
  reviewRemoved: "আপনার রিভিউ সরানো হলো।",

  noSale: "এই বিক্রি নেই।",
  noCustomer: "এই ক্রেতা নেই।",
  sellAtLeastOne: "১ ইউনিট বা বেশি বিক্রি করুন।",
  enterPrice: "দাম ডলার ও সেন্টে লিখুন, যেমন ৪.৫০।",
  enterDiscount: "ছাড় ডলার ও সেন্টে লিখুন, অথবা খালি রাখুন।",
  enterPaid: "কত দেওয়া হলো ডলার ও সেন্টে লিখুন, ০ বা বেশি।",
  enterAmount: "অঙ্কটি ডলার ও সেন্টে লিখুন, যেমন ২০.০০।",
  choosePayment: "কীভাবে দেওয়া হলো বাছুন।",
};

export const ACTION_COPY: Copy<typeof en> = { en, bn };
