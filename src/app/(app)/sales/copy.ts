import type { PaymentMethod } from "@/db/schema";
import type { Copy } from "@/lib/i18n";

/** The sales area's words, in both languages: the list, a sale's label and the sale form. Figures arrive formatted. */

/** "Rahman Traders'", "Nadia Akter's". */
const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

const en = {
  title: "Sales",
  saleTitle: "Sale",
  newSale: "New sale",
  allSales: "All sales",

  // The list
  tallies: ["Today", "Last 28 days", "Owed by customers"] as [string, string, string],
  salesCount: (n: string, one: boolean) => (one ? `${n} sale` : `${n} sales`),
  owingCount: (n: string, one: boolean) => (one ? `${n} customer` : `${n} customers`),
  listTitle: "Recent sales",
  listNote:
    "Sales with prices, newest first. A quick sale from Record stock has no price: it's in its product's ledger, and analytics counts it at list price.",
  columns: { sale: "Sale", customer: "Customer", date: "Date", lines: "Lines", total: "Total", due: "Due" },
  walkIn: "Walk-in",
  voided: "Voided",
  empty: "No sales with prices yet.",
  emptyHelp: "Record one with New sale: several products, their prices, a customer, and what's paid now.",

  // The form
  form: {
    title: "New sale",
    help: "Prices start at each product's list price. The stock leaves the shelves when the sale is recorded.",
    customer: "Customer",
    walkInOption: "Walk-in, pays now",
    customerHint: "A customer can pay part now and the rest later. A walk-in pays the whole total.",
    addCustomer: "Add a customer",
    lines: "Lines",
    addProduct: "Add a product",
    pickProduct: "Name or SKU",
    nothingToSell: "Nothing is in stock to sell.",
    pickerNoMatch: (query: string) => `Nothing in stock matches “${query}”.`,
    pickerOnHand: (n: string) => `${n} on hand`,
    noLines: "Add the first product above.",
    product: "Product",
    quantity: "Quantity",
    price: "Unit price",
    discount: "Discount",
    lineTotal: "Line total",
    listPrice: (price: string) => `List ${price}`,
    remove: (name: string) => `Remove ${name}`,
    subtotal: "Subtotal",
    saleDiscount: "Discount on the sale",
    total: "Total",
    paid: "Paid now",
    method: "Paid by",
    due: "Due",
    dueOnAccount: (name: string) => `Goes on ${possessive(name)} account.`,
    paidInFull: "Paid in full.",
    nothingYet: "Nothing to pay for yet.",
    note: "Note",
    submit: "Record sale",
    saving: "Recording…",
    recorded: (number: string) => `Recorded ${number}`,
    left: (n: string) => `${n} left`,
  },
  methods: { cash: "Cash", mobile: "Mobile money", card: "Card", bank: "Bank transfer" } as Record<
    PaymentMethod,
    string
  >,

  // A sale's label
  labelTallies: ["Lines", "Units", "Total"] as [string, string, string],
  status: {
    paid: { lead: "Paid in full.", text: "Nothing is owed on this sale." },
    due: (due: string, customer: string) => ({
      lead: `${due} due.`,
      text: `On ${possessive(customer)} account. Money paid at a sale settles it; later payments settle the oldest sale first.`,
    }),
    voided: {
      lead: "Voided.",
      text: "Its stock went back on the shelves, and it no longer counts in what's owed.",
    },
  },
  linesTitle: "Lines",
  subtotal: "Subtotal",
  saleDiscount: "Discount on the sale",
  total: "Total",
  history: "History",
  soldBy: (name: string) => `Sold by ${name}`,
  paidAt: (amount: string, method: string) => `Paid ${amount} by ${method.toLowerCase()}`,
  voidedLine: "Voided; its stock went back",
  note: "Note",
  void: {
    button: "Void sale",
    confirmTitle: "Void this sale?",
    confirmText:
      "Its stock goes back on the shelves and it no longer counts in what's owed. Money paid isn't refunded here.",
    confirm: "Void sale",
    keep: "Keep it",
    voiding: "Voiding…",
    done: (number: string) => `Voided ${number}`,
  },
  gone: "Sale updated.",
  adminOnly: "Only an admin can void a sale.",
};

export type SalesCopy = typeof en;

const bn: SalesCopy = {
  title: "বিক্রি",
  saleTitle: "বিক্রি",
  newSale: "নতুন বিক্রি",
  allSales: "সব বিক্রি",

  tallies: ["আজ", "গত ২৮ দিন", "ক্রেতাদের কাছে পাওনা"],
  salesCount: (n) => `${n}টি বিক্রি`,
  owingCount: (n) => `${n} জন ক্রেতা`,
  listTitle: "সাম্প্রতিক বিক্রি",
  listNote:
    "দামসহ বিক্রি, নতুনগুলো আগে। স্টক লিখুন থেকে করা দ্রুত বিক্রিতে দাম থাকে না: সেটি পণ্যের খাতায় আছে, আর বিশ্লেষণে তালিকা দামে ধরা হয়।",
  columns: { sale: "বিক্রি", customer: "ক্রেতা", date: "তারিখ", lines: "লাইন", total: "মোট", due: "বাকি" },
  walkIn: "সরাসরি ক্রেতা",
  voided: "বাতিল",
  empty: "এখনো দামসহ কোনো বিক্রি নেই।",
  emptyHelp: "নতুন বিক্রি দিয়ে একটি লিখুন: কয়েকটি পণ্য, তাদের দাম, ক্রেতা, আর এখন কত দেওয়া হলো।",

  form: {
    title: "নতুন বিক্রি",
    help: "দাম শুরু হয় প্রতিটি পণ্যের তালিকা দাম থেকে। বিক্রি লেখার সাথে সাথে মজুত তাক থেকে কমে যায়।",
    customer: "ক্রেতা",
    walkInOption: "সরাসরি ক্রেতা, এখনই দেবেন",
    customerHint: "ক্রেতা এখন কিছু দিয়ে বাকিটা পরে দিতে পারেন। সরাসরি ক্রেতা পুরো মোট দেন।",
    addCustomer: "ক্রেতা যোগ করুন",
    lines: "লাইন",
    addProduct: "পণ্য যোগ করুন",
    pickProduct: "নাম বা SKU",
    nothingToSell: "বিক্রির মতো কিছু মজুতে নেই।",
    pickerNoMatch: (query) => `মজুতে “${query}”-এর সাথে মেলে এমন কিছু নেই।`,
    pickerOnHand: (n) => `মজুত ${n}`,
    noLines: "ওপরে প্রথম পণ্যটি যোগ করুন।",
    product: "পণ্য",
    quantity: "পরিমাণ",
    price: "একক দাম",
    discount: "ছাড়",
    lineTotal: "লাইনের মোট",
    listPrice: (price) => `তালিকা ${price}`,
    remove: (name) => `${name} সরান`,
    subtotal: "উপমোট",
    saleDiscount: "পুরো বিক্রিতে ছাড়",
    total: "মোট",
    paid: "এখন দেওয়া",
    method: "যেভাবে দেওয়া",
    due: "বাকি",
    dueOnAccount: (name) => `${name}-এর হিসাবে বাকি থাকবে।`,
    paidInFull: "পুরোটা দেওয়া হয়েছে।",
    nothingYet: "এখনো দাম দেওয়ার মতো কিছু নেই।",
    note: "নোট",
    submit: "বিক্রি লিখুন",
    saving: "লেখা হচ্ছে…",
    recorded: (number) => `${number} লেখা হলো`,
    left: (n) => `থাকবে ${n}`,
  },
  methods: { cash: "নগদ", mobile: "মোবাইল ব্যাংকিং", card: "কার্ড", bank: "ব্যাংক ট্রান্সফার" },

  labelTallies: ["লাইন", "ইউনিট", "মোট"],
  status: {
    paid: { lead: "পুরোটা দেওয়া হয়েছে।", text: "এই বিক্রিতে কিছু বাকি নেই।" },
    due: (due, customer) => ({
      lead: `বাকি ${due}।`,
      text: `${customer}-এর হিসাবে। বিক্রির সময় দেওয়া টাকা সেই বিক্রি মেটায়; পরের পরিশোধ আগে পুরনো বিক্রি মেটায়।`,
    }),
    voided: { lead: "বাতিল।", text: "এর মজুত তাকে ফিরে গেছে, আর পাওনার হিসাবে এটি আর ধরা হয় না।" },
  },
  linesTitle: "লাইন",
  subtotal: "উপমোট",
  saleDiscount: "পুরো বিক্রিতে ছাড়",
  total: "মোট",
  history: "ইতিহাস",
  soldBy: (name) => `বিক্রি করেছেন ${name}`,
  paidAt: (amount, method) => `${method}-এ ${amount} দেওয়া হয়েছে`,
  voidedLine: "বাতিল; মজুত ফিরে গেছে",
  note: "নোট",
  void: {
    button: "বিক্রি বাতিল",
    confirmTitle: "এই বিক্রি বাতিল করবেন?",
    confirmText: "এর মজুত তাকে ফিরে যাবে, আর পাওনার হিসাবে এটি আর ধরা হবে না। দেওয়া টাকা এখানে ফেরত হয় না।",
    confirm: "বিক্রি বাতিল",
    keep: "রেখে দিন",
    voiding: "বাতিল হচ্ছে…",
    done: (number) => `${number} বাতিল হলো`,
  },
  gone: "বিক্রি হালনাগাদ হয়েছে।",
  adminOnly: "শুধু একজন অ্যাডমিন বিক্রি বাতিল করতে পারেন।",
};

export const SALES_COPY: Copy<SalesCopy> = { en, bn };
