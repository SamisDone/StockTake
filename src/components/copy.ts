import { formats } from "@/lib/format";
import type { Copy } from "@/lib/i18n";

/** Words printed by the shared components, in both languages. */

const en = {
  // Stock marks and cover
  out: "Out",
  reorder: "Reorder",
  noSales: "No sales in 28 days",
  noneLeft: "None left",
  lead: (days: number) => `lead ${formats("en").days(days)}`,

  // Fields and labels
  optional: "(optional)",
  edit: "Edit",
  discard: {
    title: "Discard your changes?",
    body: "What you've changed here hasn't been saved.",
    keep: "Keep editing",
    discard: "Discard",
  },
  stars: (rating: string) => `${rating} out of 5 stars`,

  // The demo doors
  openDemo: "Open the live demo",
  signingIn: "Signing in…",

  // Preferences
  currency: "Currency",
  currencies: { USD: "Dollars", BDT: "Taka" },
  takaAt: (rate: string) => `taka at ${rate}`,
  rate: (perDollar: string, day: string | null) => `$1 = ৳${perDollar}${day ? ` on ${day}` : ""}`,
  language: "Language",
  theme: "Theme",
  themes: { system: "System", light: "Light", dark: "Dark" },

  // Toasts
  notifications: "Notifications",
  undo: "Undo",
  undoing: "Undoing…",
  open: "Open",
  dismiss: "Dismiss",
};

const bn: typeof en = {
  out: "শেষ",
  reorder: "অর্ডার দিন",
  noSales: "২৮ দিনে বিক্রি নেই",
  noneLeft: "কিছু নেই",
  lead: (days) => `সরবরাহ ${formats("bn").days(days)}`,

  optional: "(ঐচ্ছিক)",
  edit: "সম্পাদনা",
  discard: {
    title: "পরিবর্তনগুলো বাদ দেবেন?",
    body: "এখানে যা বদলেছেন তা এখনো সংরক্ষণ করা হয়নি।",
    keep: "সম্পাদনা চালিয়ে যান",
    discard: "বাদ দিন",
  },
  stars: (rating) => `৫-এর মধ্যে ${rating} তারা`,

  openDemo: "লাইভ ডেমো খুলুন",
  signingIn: "সাইন ইন হচ্ছে…",

  currency: "মুদ্রা",
  currencies: { USD: "ডলার", BDT: "টাকা" },
  takaAt: (rate) => `টাকা, ${rate}`,
  rate: (perDollar, day) => `$১ = ৳${perDollar}${day ? `, ${day}-এর হার` : ""}`,
  language: "ভাষা",
  theme: "থিম",
  themes: { system: "সিস্টেম", light: "হালকা", dark: "গাঢ়" },

  notifications: "বার্তা",
  undo: "ফিরিয়ে নিন",
  undoing: "ফিরিয়ে নেওয়া হচ্ছে…",
  open: "খুলুন",
  dismiss: "বন্ধ করুন",
};

export const COMPONENT_COPY: Copy<typeof en> = { en, bn };
