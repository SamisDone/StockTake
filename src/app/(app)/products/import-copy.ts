import { formats } from "@/lib/format";
import type { Copy } from "@/lib/i18n";

/** The import screen's words, in both languages. Figures arrive already formatted. */

const en = {
  title: "Import products",
  intro:
    "One product per row, matched by its SKU. A new SKU adds a product; a known one takes what its row says, and a blank cell leaves that value as it is. An On hand figure is recorded as a count. Money is in US dollars.",
  file: "File",
  noFile: "No file chosen",
  choose: "Choose a CSV file",
  chooseAnother: "Choose another file",
  reading: "Reading…",
  dropHere: "Drop the file here",
  dropHint: "Or drag a .csv file onto this field.",
  template: {
    before: "Start from the catalog as it is:",
    link: "download products.csv",
    after: ", change it in a spreadsheet, and bring it back.",
  },
  spreadsheet: "That's a spreadsheet workbook. Save it as CSV first (File, Save as, CSV UTF-8), then choose that file.",
  tooLarge: "That file is over 500 KB. Split it into smaller files.",
  unreadable: "That file couldn't be read. Choose it again.",
  failed: "The file couldn't be checked just now. Try again.",

  tallies: ["New", "Updated", "Counts", "Problems"] as [string, string, string, string],
  suppliersTally: "New suppliers",
  blocked: (n: number) =>
    n === 1 ? "Fix the problem above to import." : `Fix the ${formats("en").count(n)} problems above to import.`,
  problemsTitle: "Fix these first",
  problemsHelp:
    "Nothing is imported while any row has a problem. Fix them in the spreadsheet, save, and choose the file again.",
  fileProblem: "The file",
  line: (n: string) => `Line ${n}`,
  newSuppliers: (names: string) =>
    `Adds a supplier for each name not on the list yet: ${names}. Their lead time starts at 7 days; edit it on the supplier's label.`,
  ignored: (names: string) => `Not read: ${names}.`,
  changesTitle: "What changes",
  matching: (n: number) =>
    n === 1 ? "1 row matches the catalog already." : `${formats("en").count(n)} rows match the catalog already.`,
  nothing: "Nothing in this file changes the catalog.",
  columns: { line: "Line", product: "Product", change: "Change" },
  added: "Added",
  count: "Count",
  arrow: "→",
  blank: "blank",
  submit: (n: number) => (n === 1 ? "Import 1 product" : `Import ${formats("en").count(n)} products`),
  importing: "Importing…",
  done: "Imported.",
  doneText: (parts: string[]) =>
    `${parts.join(", ")}. Each change is in the activity log, and each count in its product's ledger.`,
  doneParts: {
    created: (n: string) => `${n} added`,
    updated: (n: string) => `${n} updated`,
    counted: (n: string) => `${n} counted`,
    suppliers: (n: string) => `${n} new ${n === "1" ? "supplier" : "suppliers"}`,
  },
  toast: (n: string) => `Imported ${n} rows`,
  finish: "Done",
  another: "Import another file",
};

export type ImportCopy = typeof en;

const n = formats("bn").count;

const bn: ImportCopy = {
  title: "পণ্য আনুন",
  intro:
    "প্রতি সারিতে একটি পণ্য, SKU দিয়ে মেলানো। নতুন SKU হলে পণ্য যোগ হয়; চেনা হলে সারিতে যা লেখা তা নেয়, আর ফাঁকা ঘর থাকলে সেই মান যেমন আছে তেমনই থাকে। মজুতের সংখ্যা গণনা হিসেবে লেখা হয়। টাকার অঙ্ক মার্কিন ডলারে।",
  file: "ফাইল",
  noFile: "কোনো ফাইল বাছা হয়নি",
  choose: "একটি CSV ফাইল বাছুন",
  chooseAnother: "অন্য ফাইল বাছুন",
  reading: "পড়া হচ্ছে…",
  dropHere: "ফাইলটি এখানে ছাড়ুন",
  dropHint: "অথবা একটি .csv ফাইল টেনে এই ঘরে আনুন।",
  template: {
    before: "এখনকার ক্যাটালগ থেকে শুরু করুন:",
    link: "products.csv নামান",
    after: ", স্প্রেডশিটে বদলান, তারপর ফিরিয়ে আনুন।",
  },
  spreadsheet:
    "এটি একটি স্প্রেডশিট ওয়ার্কবুক। আগে CSV হিসেবে সংরক্ষণ করুন (File, Save as, CSV UTF-8), তারপর সেই ফাইলটি বাছুন।",
  tooLarge: "ফাইলটি ৫০০ KB-এর বেশি। কয়েকটি ছোট ফাইলে ভাগ করুন।",
  unreadable: "ফাইলটি পড়া গেল না। আবার বাছুন।",
  failed: "এই মুহূর্তে ফাইলটি দেখা গেল না। আবার চেষ্টা করুন।",

  tallies: ["নতুন", "হালনাগাদ", "গণনা", "সমস্যা"],
  suppliersTally: "নতুন সরবরাহকারী",
  blocked: (count) => `আনতে হলে ওপরের ${n(count)}টি সমস্যা ঠিক করুন।`,
  problemsTitle: "আগে এগুলো ঠিক করুন",
  problemsHelp: "কোনো সারিতে সমস্যা থাকলে কিছুই আনা হয় না। স্প্রেডশিটে ঠিক করে সংরক্ষণ করুন, তারপর ফাইলটি আবার বাছুন।",
  fileProblem: "ফাইল",
  line: (v) => `লাইন ${v}`,
  newSuppliers: (names) =>
    `তালিকায় নেই এমন প্রতিটি নামের জন্য একজন সরবরাহকারী যোগ হবে: ${names}। তাদের লিড টাইম শুরুতে ৭ দিন; সরবরাহকারীর লেবেলে বদলানো যায়।`,
  ignored: (names) => `পড়া হয়নি: ${names}।`,
  changesTitle: "কী বদলাবে",
  matching: (count) => `${n(count)}টি সারি ক্যাটালগের সাথে আগেই মেলে।`,
  nothing: "এই ফাইলে ক্যাটালগের কিছুই বদলায় না।",
  columns: { line: "লাইন", product: "পণ্য", change: "পরিবর্তন" },
  added: "যোগ হবে",
  count: "গণনা",
  arrow: "→",
  blank: "ফাঁকা",
  submit: (count) => `${n(count)}টি পণ্য আনুন`,
  importing: "আনা হচ্ছে…",
  done: "আনা হয়েছে।",
  doneText: (parts) => `${parts.join(", ")}। প্রতিটি পরিবর্তন কার্যক্রমে, আর প্রতিটি গণনা তার পণ্যের খাতায় আছে।`,
  doneParts: {
    created: (v) => `${v}টি যোগ হয়েছে`,
    updated: (v) => `${v}টি হালনাগাদ`,
    counted: (v) => `${v}টি গোনা`,
    suppliers: (v) => `${v} জন নতুন সরবরাহকারী`,
  },
  toast: (v) => `${v}টি সারি আনা হয়েছে`,
  finish: "শেষ",
  another: "আরেকটি ফাইল আনুন",
};

export const IMPORT_COPY: Copy<ImportCopy> = { en, bn };
