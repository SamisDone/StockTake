import type { Copy } from "@/lib/i18n";

/** The suppliers area's words, in both languages. Figures arrive already formatted. */

const en = {
  title: "Suppliers",
  supplierTitle: "Supplier",
  newTitle: "New supplier",
  addSupplier: "Add supplier",
  allSuppliers: "All suppliers",

  // The list
  tallies: ["Suppliers", "On order", "On time"] as [string, string, string],
  receivedOf: (onTime: string, received: string) => `${onTime} of ${received} received`,
  noSuppliers: "No suppliers yet.",
  caption: "Suppliers by name. Select one to see its products, orders and reviews.",
  archived: "Archived",
  archivedHelp: "They take no new orders; their history stays. An admin restores one from its label.",
  archivedOn: (day: string) => `Archived ${day}`,
  columns: {
    supplier: "Supplier",
    leadTime: "Lead time",
    products: "Products",
    onOrder: "On order",
    onTime: "On time",
    rating: "Rating",
  },
  days: (n: number, text: string) => `${text} ${n === 1 ? "day" : "days"}`,
  low: (n: string) => `${n} low`,
  of: (n: string) => `of ${n}`,
  noReviews: "No reviews",

  // A supplier's label
  noContact: "No contact details",
  labelTallies: ["Lead time", "Products", "On time", "Rating"],
  runningLow: (n: string) => `${n} running low`,
  noneLow: "None running low",
  nothingReceived: "Nothing received yet",
  byDueDay: (onTime: string, received: string) => `${onTime} of ${received} by the due day`,
  reviewCount: (n: number, text: string) => `${text} ${n === 1 ? "review" : "reviews"}`,
  products: "Products",
  productsHelp: (supplier: string, days: string) =>
    `What ${supplier} supplies, most urgent first. Cover is measured against their ${days}‑day lead time.`,
  noProducts: (supplier: string) => `No active products come from ${supplier}.`,
  productsCaption: (n: string) => `${n} products, most urgent first.`,
  product: "Product",
  onHand: "On hand",
  cover: "Cover",
  orders: "Orders",
  noOrders: (supplier: string) => `Nothing has been ordered from ${supplier} yet.`,
  latestOrders: (limit: string, total: string) => `The latest ${limit} of ${total}, newest first.`,
  newestFirst: "Newest first.",
  newOrder: "New order",
  late: "Late",
  placed: "Placed",
  reviews: "Reviews",
  reviewsHelp: "One per person, from the people who order from and receive from them. Yours replaces your last one.",
  gone: "Archived. It can be restored from its label.",
  status: {
    archived: (isAdmin: boolean) => ({
      lead: "Archived.",
      text: `It takes no new orders, so its products can't be ordered until it's restored or they're given another supplier. Its orders stay as they were${isAdmin ? "" : ", and an admin can restore it"}.`,
    }),
    reorder: (names: string[], cost: string) => ({
      lead: "Reorder.",
      text: `${englishList(names)} ${names.length === 1 ? "is" : "are"} running low. A draft puts the forecast's quantities on one order, ${cost} at today's costs; nothing is sent until an admin places it.`,
    }),
    drafted: { lead: "Drafted.", before: "What's running low is on ", after: ", waiting to be placed." },
    stocked: (supplier: string) => ({
      lead: "Stocked.",
      text: `Nothing from ${supplier} needs ordering, counting what's already on order.`,
    }),
  },

  // The supplier form
  form: {
    editTitle: "Edit details",
    newTitle: "New supplier",
    editHelp:
      "Changes go in the activity log. A new lead time changes the cover and suggestions of every product they supply.",
    newHelp: "Once it's added, give products this supplier on their labels, and order from it.",
    editLegend: "Supplier details",
    newLegend: "The new supplier",
    name: "Name",
    email: "Email",
    phone: "Phone",
    leadTime: "Lead time",
    leadTimeHint: "Days from placing an order to it arriving. Cover is measured against it.",
    days: "days",
    saving: "Saving…",
    adding: "Adding…",
    cancel: "Cancel",
    save: "Save changes",
    add: "Add supplier",
    saved: "Saved changes.",
  },
  archive: {
    title: "Archive",
    text: (name: string) =>
      `Takes ${name} off the list and out of new orders. Its orders and reviews stay, and an admin can restore it.`,
    products: (n: number, text: string) =>
      ` Its ${text} ${n === 1 ? "product" : "products"} can't be ordered until then, or until they're given another supplier.`,
    archiving: "Archiving…",
    button: "Archive supplier",
    restore: "Restore supplier",
    restoring: "Restoring…",
  },
  adminOnly: "Only an admin can add suppliers. You can rate any supplier, and draft orders to them, from their label.",

  // Reviews
  review: {
    words: ["Poor", "Fair", "Good", "Very good", "Excellent"],
    legend: (supplier: string) => `Your review of ${supplier}`,
    yourRating: "Your rating",
    star: (n: number, text: string, word: string) => `${text} ${n === 1 ? "star" : "stars"}, ${word.toLowerCase()}`,
    notRated: "Not rated",
    comment: "Comment",
    placeholder: (supplier: string) => `How ${supplier} has been to order from`,
    saving: "Saving…",
    removing: "Removing…",
    remove: "Remove my review",
    update: "Update review",
    save: "Save review",
  },
};

function englishList(items: string[]) {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
function banglaList(items: string[]) {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} ও ${items.at(-1)}`;
}

export type SuppliersCopy = typeof en;

const bn: SuppliersCopy = {
  title: "সরবরাহকারী",
  supplierTitle: "সরবরাহকারী",
  newTitle: "নতুন সরবরাহকারী",
  addSupplier: "সরবরাহকারী যোগ করুন",
  allSuppliers: "সব সরবরাহকারী",

  tallies: ["সরবরাহকারী", "অর্ডারে", "সময়মতো"],
  receivedOf: (onTime, received) => `${received}টির মধ্যে ${onTime}টি সময়মতো`,
  noSuppliers: "এখনো কোনো সরবরাহকারী নেই।",
  caption: "নাম অনুযায়ী সরবরাহকারী। পণ্য, অর্ডার ও রিভিউ দেখতে একটি বেছে নিন।",
  archived: "আর্কাইভ",
  archivedHelp: "এরা নতুন অর্ডার নেয় না; ইতিহাস থেকে যায়। অ্যাডমিন লেবেল থেকে ফিরিয়ে আনতে পারেন।",
  archivedOn: (day) => `আর্কাইভ ${day}`,
  columns: {
    supplier: "সরবরাহকারী",
    leadTime: "সরবরাহ সময়",
    products: "পণ্য",
    onOrder: "অর্ডারে",
    onTime: "সময়মতো",
    rating: "রেটিং",
  },
  days: (_n, text) => `${text} দিন`,
  low: (n) => `${n}টি কম`,
  of: (n) => `/ ${n}`,
  noReviews: "রিভিউ নেই",

  noContact: "যোগাযোগের তথ্য নেই",
  labelTallies: ["সরবরাহ সময়", "পণ্য", "সময়মতো", "রেটিং"],
  runningLow: (n) => `${n}টি কমে আসছে`,
  noneLow: "কোনোটি কম নেই",
  nothingReceived: "এখনো কিছু আসেনি",
  byDueDay: (onTime, received) => `${received}টির মধ্যে ${onTime}টি নির্ধারিত দিনে`,
  reviewCount: (_n, text) => `${text}টি রিভিউ`,
  products: "পণ্য",
  productsHelp: (supplier, days) =>
    `${supplier} যা সরবরাহ করে, সবচেয়ে জরুরিগুলো আগে। মজুত কত দিন চলবে, তা তাদের ${days} দিনের সরবরাহ সময়ের সাথে মেলানো হয়।`,
  noProducts: (supplier) => `${supplier} থেকে কোনো চালু পণ্য আসে না।`,
  productsCaption: (n) => `${n}টি পণ্য, সবচেয়ে জরুরিগুলো আগে।`,
  product: "পণ্য",
  onHand: "মজুত",
  cover: "চলবে",
  orders: "অর্ডার",
  noOrders: (supplier) => `${supplier}-এর কাছে এখনো কিছু অর্ডার করা হয়নি।`,
  latestOrders: (limit, total) => `মোট ${total}টির মধ্যে সর্বশেষ ${limit}টি, নতুনগুলো ওপরে।`,
  newestFirst: "নতুনগুলো ওপরে।",
  newOrder: "নতুন অর্ডার",
  late: "দেরি",
  placed: "দেওয়া হয়েছে",
  reviews: "রিভিউ",
  reviewsHelp:
    "যাঁরা এদের কাছে অর্ডার দেন ও মাল বুঝে নেন, তাঁদের প্রত্যেকের একটি করে। আপনার নতুন রিভিউ আগেরটির জায়গা নেয়।",
  gone: "আর্কাইভ হলো। লেবেল থেকে আবার ফিরিয়ে আনা যাবে।",
  status: {
    archived: (isAdmin) => ({
      lead: "আর্কাইভ করা।",
      text: `এটি নতুন অর্ডার নেয় না, তাই ফিরিয়ে আনা বা অন্য সরবরাহকারী ঠিক না করা পর্যন্ত এর পণ্য অর্ডার করা যাবে না। এর অর্ডারগুলো আগের মতোই থাকবে${isAdmin ? "" : ", আর অ্যাডমিন এটি ফিরিয়ে আনতে পারেন"}।`,
    }),
    reorder: (names, cost) => ({
      lead: "অর্ডার দিন।",
      text: `${banglaList(names)} কমে আসছে। খসড়া করলে পূর্বাভাসের পরিমাণগুলো একটি অর্ডারে উঠবে, আজকের দামে ${cost}; অ্যাডমিন অর্ডার না দেওয়া পর্যন্ত কিছুই পাঠানো হয় না।`,
    }),
    drafted: { lead: "খসড়া হয়েছে।", before: "যা কমে আসছে তা আছে ", after: "-এ, অর্ডার দেওয়ার অপেক্ষায়।" },
    stocked: (supplier) => ({
      lead: "মজুত ঠিক আছে।",
      text: `অর্ডারে থাকা মাল ধরে ${supplier} থেকে এখন কিছু অর্ডার করার দরকার নেই।`,
    }),
  },

  form: {
    editTitle: "বিবরণ সম্পাদনা",
    newTitle: "নতুন সরবরাহকারী",
    editHelp:
      "পরিবর্তনগুলো কার্যক্রমে লেখা থাকে। নতুন সরবরাহ সময় দিলে তাদের প্রতিটি পণ্যের চলবে-হিসাব ও প্রস্তাব বদলে যায়।",
    newHelp: "যোগ করার পর পণ্যের লেবেলে এই সরবরাহকারী ঠিক করে দিন, আর এদের কাছে অর্ডার দিন।",
    editLegend: "সরবরাহকারীর বিবরণ",
    newLegend: "নতুন সরবরাহকারী",
    name: "নাম",
    email: "ইমেইল",
    phone: "ফোন",
    leadTime: "সরবরাহ সময়",
    leadTimeHint: "অর্ডার দেওয়া থেকে মাল পৌঁছানো পর্যন্ত কত দিন। মজুত কত দিন চলবে, তা এর সাথে মেলানো হয়।",
    days: "দিন",
    saving: "সংরক্ষণ হচ্ছে…",
    adding: "যোগ হচ্ছে…",
    cancel: "বাতিল",
    save: "সংরক্ষণ করুন",
    add: "সরবরাহকারী যোগ করুন",
    saved: "পরিবর্তন সংরক্ষণ হলো।",
  },
  archive: {
    title: "আর্কাইভ",
    text: (name) =>
      `${name} তালিকা থেকে আর নতুন অর্ডার থেকে সরে যাবে। এর অর্ডার ও রিভিউ থেকে যাবে, আর অ্যাডমিন এটি ফিরিয়ে আনতে পারেন।`,
    products: (_n, text) => ` ততদিন, বা অন্য সরবরাহকারী ঠিক না করা পর্যন্ত, এর ${text}টি পণ্য অর্ডার করা যাবে না।`,
    archiving: "আর্কাইভ হচ্ছে…",
    button: "সরবরাহকারী আর্কাইভ করুন",
    restore: "সরবরাহকারী ফিরিয়ে আনুন",
    restoring: "ফিরিয়ে আনা হচ্ছে…",
  },
  adminOnly:
    "শুধু অ্যাডমিন সরবরাহকারী যোগ করতে পারেন। যেকোনো সরবরাহকারীর লেবেল থেকে আপনি রেটিং দিতে ও অর্ডারের খসড়া করতে পারেন।",

  review: {
    words: ["খারাপ", "চলনসই", "ভালো", "খুব ভালো", "চমৎকার"],
    legend: (supplier) => `${supplier} সম্পর্কে আপনার রিভিউ`,
    yourRating: "আপনার রেটিং",
    star: (_n, text, word) => `${text} তারা, ${word}`,
    notRated: "রেটিং দেওয়া হয়নি",
    comment: "মন্তব্য",
    placeholder: (supplier) => `${supplier}-এর কাছে অর্ডার দেওয়ার অভিজ্ঞতা কেমন`,
    saving: "সংরক্ষণ হচ্ছে…",
    removing: "সরানো হচ্ছে…",
    remove: "আমার রিভিউ সরান",
    update: "রিভিউ হালনাগাদ করুন",
    save: "রিভিউ সংরক্ষণ করুন",
  },
};

export const SUPPLIERS_COPY: Copy<SuppliersCopy> = { en, bn };
