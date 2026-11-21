import type { PurchaseOrderStatus } from "@/db/schema";
import type { Copy } from "@/lib/i18n";

/** The purchase orders area's words, in both languages. Figures arrive already formatted. */

type Show = "open" | PurchaseOrderStatus | "all";

const en = {
  title: "Purchase orders",
  orderTitle: "Purchase order",
  newTitle: "New order",
  newOrder: "New order",
  allOrders: "All orders",
  status: { draft: "Draft", ordered: "Placed", received: "Received", cancelled: "Cancelled" } as Record<
    PurchaseOrderStatus,
    string
  >,
  when: {
    draft: (day: string) => `Drafted ${day}`,
    ordered: (day: string) => `Due ${day}`,
    received: (day: string) => `Received ${day}`,
    cancelled: (day: string) => `Cancelled ${day}`,
  } as Record<PurchaseOrderStatus, (day: string) => string>,

  // The list page
  tallies: ["Drafts", "On order", "Late"] as [string, string, string],
  suggested: "Suggested orders",
  suggestedHelp:
    "From the forecast: what each supplier should send so stock, counting what's already on order, lasts their lead time and 30 days more. A draft can still be changed; nothing is sent until an admin places it.",
  nothingToReorder: "Nothing to reorder.",
  supplier: "Supplier",
  products: "Products",
  cost: "Cost",
  action: "Action",
  leadTime: (days: string) => `${days}‑day lead time`,
  onDraft: (order: string) => ` · on ${order}`,
  on: "On",
  unsupplied: [
    "Also running low, with no supplier to order from: ",
    ". An admin gives each one a supplier on its label.",
  ],
  draftOrder: "Draft order",
  draftTo: (supplier: string) => `Draft an order to ${supplier}`,
  drafting: (supplier: string) => `Drafting an order to ${supplier}…`,

  // The order table
  orders: "Orders",
  show: "Show",
  shows: {
    open: "Open",
    draft: "Drafts",
    ordered: "Placed",
    received: "Received",
    cancelled: "Cancelled",
    all: "All",
  } as Record<Show, string>,
  empty: {
    open: "No open orders. Draft one from the suggestions above.",
    draft: "No drafts.",
    ordered: "Nothing is on order.",
    received: "Nothing has been received yet.",
    cancelled: "No cancelled orders.",
    all: "No orders yet.",
  } as Record<Show, string>,
  caption: (n: string) => `${n} orders, newest first. Select one to see its lines and history.`,
  columns: { order: "Order", status: "Status", lines: "Lines", total: "Total", date: "Date" },
  late: "Late",

  // An order's label
  labelTallies: ["Lines", "Units", "Total"] as [string, string, string],
  linesTitle: "Lines",
  lineColumns: { product: "Product", quantity: "Quantity", unitCost: "Unit cost", lineTotal: "Line total" },
  total: "Total",
  history: "History",
  draftedBy: (name: string) => `Drafted by ${name}`,
  placedWith: (supplier: string) => `Placed with ${supplier}`,
  receivedLine: (n: number, count: string) =>
    `Received: ${count} ${n === 1 ? "receipt" : "receipts"} booked into stock`,
  cancelledLine: "Cancelled",
  notes: "Notes",
  gone: "It's no longer a draft, so its lines can't be changed.",
  statusText: {
    draft: (supplier: string, expected: string | null) => ({
      lead: "Draft.",
      text: `Nothing has been sent. Placing it sends it to ${supplier}, and its units count as on order from then.${
        expected ? ` It's expected ${expected}, the date they gave.` : ""
      }`,
    }),
    gaveDate: "the date they gave",
    leadBasis: (days: string) => `a ${days}‑day lead time`,
    late: (due: string, ago: string, basis: string) => ({
      lead: "Late.",
      text: `It was due ${due}, ${ago} ago (${basis}). Receive it when it arrives, or cancel it.`,
    }),
    onItsWay: (due: string, basis: string) => ({
      lead: "On its way.",
      text: `Due ${due}, from ${basis}. Receiving it books every line into stock.`,
    }),
    received: {
      lead: "Received.",
      text: "Each line was booked into stock as a receipt, and shows in its product's ledger.",
    },
    cancelled: { lead: "Cancelled.", text: "Nothing was received, and it can't be reopened." },
  },

  // Next step
  adminPlaces: "An admin places this draft, or cancels it.",
  nextStep: "Next step",
  receiveHelp: "Receive it once the delivery is checked in. That books one receipt per line: ",
  busy: { place: "Placing…", cancel: "Cancelling…", receive: "Receiving…" },
  confirmCancel: (order: string) => `Cancel ${order}? It can't be reopened.`,
  keep: "Keep it",
  cancelOrder: "Cancel order",
  placeOrder: "Place order",
  receiveDelivery: "Receive delivery",

  // The draft form
  form: {
    editTitle: (order: string) => `Edit ${order}`,
    newTitle: "New order",
    editHelp: (supplier: string | null) =>
      `Lines to ${supplier ?? "the supplier"}, what they cost, and when it's due. Changes go in the activity log.`,
    newHelp: "It starts as a draft. Nothing is sent until an admin places it.",
    editLegend: "The draft",
    newLegend: "The new order",
    supplier: "Supplier",
    supplierHint: (days: string, clears: boolean) =>
      `Delivers in ${days} days.${clears ? " Choosing another supplier clears the lines." : ""}`,
    supplierNone: "An order goes to one supplier, for the products it supplies.",
    chooseSupplier: "Choose a supplier",
    lines: "Lines",
    nothingYet: (supplier: string | null) =>
      supplier
        ? `Nothing on it yet. Add what ${supplier} should send.`
        : "Choose a supplier, then add what it should send.",
    columns: { product: "Product", quantity: "Quantity", unitCost: "Unit cost", lineTotal: "Line total" },
    addProduct: "Add a product",
    supplierFirst: "Choose a supplier first",
    nothingElse: (supplier: string) => `${supplier} has nothing else to order`,
    allOn: (supplier: string) => `Everything ${supplier} supplies is on it`,
    chooseProduct: "Choose a product",
    runningLow: "Running low",
    orderSuggested: (name: string, n: string) => `${name} (order ${n})`,
    everythingElse: "Everything else",
    from: (supplier: string) => `From ${supplier}`,
    add: "Add",
    total: "Total",
    totals: (lines: number, linesText: string, units: number, unitsText: string) =>
      `${linesText} ${lines === 1 ? "line" : "lines"}, ${unitsText} ${units === 1 ? "unit" : "units"}`,
    uncounted: (n: number, text: string) => ` · ${n === 1 ? "1 line isn't" : `${text} lines aren't`} counted`,
    expected: "Expected",
    expectedHint: (supplier: string, days: string) =>
      `The date ${supplier} gave. Left empty, it's due ${days} days after it's placed.`,
    expectedNone: "The date the supplier gave. Left empty, its lead time decides.",
    notes: "Notes",
    saving: "Saving…",
    drafting: "Drafting…",
    cancel: "Cancel",
    save: "Save changes",
    draft: "Draft order",
    saved: "Saved changes.",
    added: (name: string, n: string) => `Added ${name}, ${n} units.`,
    removed: (name: string) => `Removed ${name}.`,
    cleared: "Cleared the lines: they were the other supplier's products.",
    onHand: (n: string) => ` · ${n} on hand`,
    usually: " · usually ",
    forecast: (n: string) => ` · forecast says ${n}`,
    quantityOf: (name: string) => ` of ${name}`,
    remove: (name: string) => `Remove ${name}`,
  },
};

export type OrdersCopy = typeof en;

const bn: OrdersCopy = {
  title: "ক্রয় অর্ডার",
  orderTitle: "ক্রয় অর্ডার",
  newTitle: "নতুন অর্ডার",
  newOrder: "নতুন অর্ডার",
  allOrders: "সব অর্ডার",
  status: { draft: "খসড়া", ordered: "দেওয়া হয়েছে", received: "বুঝে নেওয়া", cancelled: "বাতিল" },
  when: {
    draft: (day) => `খসড়া ${day}`,
    ordered: (day) => `আসার কথা ${day}`,
    received: (day) => `বুঝে নেওয়া ${day}`,
    cancelled: (day) => `বাতিল ${day}`,
  },

  tallies: ["খসড়া", "অর্ডারে", "দেরি"],
  suggested: "প্রস্তাবিত অর্ডার",
  suggestedHelp:
    "পূর্বাভাস থেকে: অর্ডারে থাকা মাল ধরে মজুত যেন সরবরাহ সময়ের পরও আরও ৩০ দিন চলে, সেজন্য প্রতিটি সরবরাহকারীর কাছ থেকে কী আসা উচিত। খসড়া পরে বদলানো যায়; অ্যাডমিন অর্ডার না দেওয়া পর্যন্ত কিছুই পাঠানো হয় না।",
  nothingToReorder: "এখন কিছু অর্ডার করার নেই।",
  supplier: "সরবরাহকারী",
  products: "পণ্য",
  cost: "খরচ",
  action: "কাজ",
  leadTime: (days) => `সরবরাহ সময় ${days} দিন`,
  onDraft: (order) => ` · ${order}-এ আছে`,
  on: "আছে",
  unsupplied: [
    "এগুলোও কমে আসছে, কিন্তু অর্ডার দেওয়ার মতো সরবরাহকারী নেই: ",
    "। অ্যাডমিন প্রতিটির লেবেলে একজন সরবরাহকারী ঠিক করে দেন।",
  ],
  draftOrder: "অর্ডারের খসড়া",
  draftTo: (supplier) => `${supplier}-এর জন্য অর্ডারের খসড়া করুন`,
  drafting: (supplier) => `${supplier}-এর জন্য অর্ডারের খসড়া হচ্ছে…`,

  orders: "অর্ডার",
  show: "দেখান",
  shows: {
    open: "খোলা",
    draft: "খসড়া",
    ordered: "দেওয়া হয়েছে",
    received: "বুঝে নেওয়া",
    cancelled: "বাতিল",
    all: "সব",
  },
  empty: {
    open: "কোনো খোলা অর্ডার নেই। ওপরের প্রস্তাব থেকে একটির খসড়া করুন।",
    draft: "কোনো খসড়া নেই।",
    ordered: "কিছুই অর্ডারে নেই।",
    received: "এখনো কিছু বুঝে নেওয়া হয়নি।",
    cancelled: "কোনো বাতিল অর্ডার নেই।",
    all: "এখনো কোনো অর্ডার নেই।",
  },
  caption: (n) => `${n}টি অর্ডার, নতুনগুলো ওপরে। লাইন ও ইতিহাস দেখতে একটি বেছে নিন।`,
  columns: { order: "অর্ডার", status: "অবস্থা", lines: "লাইন", total: "মোট", date: "তারিখ" },
  late: "দেরি",

  labelTallies: ["লাইন", "ইউনিট", "মোট"],
  linesTitle: "লাইন",
  lineColumns: { product: "পণ্য", quantity: "পরিমাণ", unitCost: "একক দাম", lineTotal: "লাইনের মোট" },
  total: "মোট",
  history: "ইতিহাস",
  draftedBy: (name) => `খসড়া করেছেন ${name}`,
  placedWith: (supplier) => `${supplier}-কে দেওয়া হয়েছে`,
  receivedLine: (_n, count) => `বুঝে নেওয়া: ${count}টি প্রাপ্তি মজুতে যোগ হয়েছে`,
  cancelledLine: "বাতিল",
  notes: "নোট",
  gone: "এটি আর খসড়া নেই, তাই এর লাইন বদলানো যাবে না।",
  statusText: {
    draft: (supplier, expected) => ({
      lead: "খসড়া।",
      text: `এখনো কিছু পাঠানো হয়নি। অর্ডার দিলে এটি ${supplier}-এর কাছে যাবে, আর তখন থেকে এর ইউনিটগুলো অর্ডারে ধরা হবে।${
        expected ? ` তাদের দেওয়া তারিখ অনুযায়ী এটি আসার কথা ${expected}।` : ""
      }`,
    }),
    gaveDate: "তাদের দেওয়া তারিখ",
    leadBasis: (days) => `${days} দিনের সরবরাহ সময়`,
    late: (due, ago, basis) => ({
      lead: "দেরি।",
      text: `এটি আসার কথা ছিল ${due}, ${ago} আগে (${basis})। পৌঁছালে বুঝে নিন, নইলে বাতিল করুন।`,
    }),
    onItsWay: (due, basis) => ({
      lead: "পথে আছে।",
      text: `আসার কথা ${due}, ${basis} অনুযায়ী। বুঝে নিলে প্রতিটি লাইন মজুতে যোগ হবে।`,
    }),
    received: {
      lead: "বুঝে নেওয়া।",
      text: "প্রতিটি লাইন প্রাপ্তি হিসেবে মজুতে যোগ হয়েছে, আর পণ্যের খাতায় দেখা যাচ্ছে।",
    },
    cancelled: { lead: "বাতিল।", text: "কিছুই আসেনি, আর এটি আবার খোলা যাবে না।" },
  },

  adminPlaces: "অ্যাডমিন এই খসড়ার অর্ডার দেন, অথবা বাতিল করেন।",
  nextStep: "পরের ধাপ",
  receiveHelp: "ডেলিভারি মিলিয়ে নেওয়ার পর বুঝে নিন। এতে প্রতিটি লাইনের জন্য একটি করে প্রাপ্তি লেখা হবে: ",
  busy: { place: "অর্ডার দেওয়া হচ্ছে…", cancel: "বাতিল হচ্ছে…", receive: "বুঝে নেওয়া হচ্ছে…" },
  confirmCancel: (order) => `${order} বাতিল করবেন? এটি আর খোলা যাবে না।`,
  keep: "রেখে দিন",
  cancelOrder: "অর্ডার বাতিল",
  placeOrder: "অর্ডার দিন",
  receiveDelivery: "ডেলিভারি বুঝে নিন",

  form: {
    editTitle: (order) => `${order} সম্পাদনা`,
    newTitle: "নতুন অর্ডার",
    editHelp: (supplier) =>
      `${supplier ?? "সরবরাহকারী"}-এর কাছে কী যাবে, দাম কত, আর কবে আসার কথা। পরিবর্তনগুলো কার্যক্রমে লেখা থাকে।`,
    newHelp: "শুরুতে এটি খসড়া থাকে। অ্যাডমিন অর্ডার না দেওয়া পর্যন্ত কিছুই পাঠানো হয় না।",
    editLegend: "খসড়া",
    newLegend: "নতুন অর্ডার",
    supplier: "সরবরাহকারী",
    supplierHint: (days, clears) =>
      `${days} দিনে পৌঁছে দেয়।${clears ? " অন্য সরবরাহকারী বাছলে লাইনগুলো মুছে যাবে।" : ""}`,
    supplierNone: "একটি অর্ডার একজন সরবরাহকারীর কাছে যায়, তাদের সরবরাহ করা পণ্যের জন্য।",
    chooseSupplier: "সরবরাহকারী বেছে নিন",
    lines: "লাইন",
    nothingYet: (supplier) =>
      supplier
        ? `এখনো কিছু নেই। ${supplier}-এর কাছ থেকে কী আসবে, যোগ করুন।`
        : "আগে সরবরাহকারী বেছে নিন, তারপর কী আসবে যোগ করুন।",
    columns: { product: "পণ্য", quantity: "পরিমাণ", unitCost: "একক দাম", lineTotal: "লাইনের মোট" },
    addProduct: "পণ্য যোগ করুন",
    supplierFirst: "আগে সরবরাহকারী বেছে নিন",
    nothingElse: (supplier) => `${supplier}-এর কাছে অর্ডার করার মতো আর কিছু নেই`,
    allOn: (supplier) => `${supplier}-এর সব পণ্যই এতে আছে`,
    chooseProduct: "পণ্য বেছে নিন",
    runningLow: "কমে আসছে",
    orderSuggested: (name, n) => `${name} (অর্ডার ${n})`,
    everythingElse: "বাকি সব",
    from: (supplier) => `${supplier} থেকে`,
    add: "যোগ",
    total: "মোট",
    totals: (_lines, linesText, _units, unitsText) => `${linesText} লাইন, ${unitsText} ইউনিট`,
    uncounted: (_n, text) => ` · ${text}টি লাইন হিসাবে ধরা হয়নি`,
    expected: "প্রত্যাশিত",
    expectedHint: (supplier, days) => `${supplier}-এর দেওয়া তারিখ। খালি রাখলে অর্ডার দেওয়ার ${days} দিন পর আসার কথা।`,
    expectedNone: "সরবরাহকারীর দেওয়া তারিখ। খালি রাখলে সরবরাহ সময় অনুযায়ী ধরা হবে।",
    notes: "নোট",
    saving: "সংরক্ষণ হচ্ছে…",
    drafting: "খসড়া হচ্ছে…",
    cancel: "বাতিল",
    save: "সংরক্ষণ করুন",
    draft: "অর্ডারের খসড়া",
    saved: "পরিবর্তন সংরক্ষণ হলো।",
    added: (name, n) => `${name} যোগ হলো, ${n} ইউনিট।`,
    removed: (name) => `${name} সরানো হলো।`,
    cleared: "লাইনগুলো মুছে ফেলা হলো: সেগুলো অন্য সরবরাহকারীর পণ্য ছিল।",
    onHand: (n) => ` · মজুত ${n}`,
    usually: " · সাধারণত ",
    forecast: (n) => ` · পূর্বাভাস ${n}`,
    quantityOf: (name) => `, ${name}`,
    remove: (name) => `${name} সরান`,
  },
};

export const ORDERS_COPY: Copy<OrdersCopy> = { en, bn };
