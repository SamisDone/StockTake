import type { Copy } from "@/lib/i18n";

/** The customers area's words, in both languages: the list, a customer's label, the form and taking a payment. */

const en = {
  title: "Customers",
  customerTitle: "Customer",
  addCustomer: "Add customer",
  allCustomers: "All customers",

  // The list
  tallies: ["Customers", "Owed to you", "Owing"] as [string, string, string],
  columns: { name: "Customer", phone: "Phone", sales: "Sales", lastSale: "Last sale", due: "Due" },
  inCredit: (amount: string) => `${amount} in credit`,
  never: "No sales yet",
  empty: "No customers yet.",
  emptyHelp: "Add one here, or from a new sale. A customer can buy on account and pay later.",

  // A customer's label
  labelTallies: ["Bought", "Paid", "Due"] as [string, string, string],
  standingNote: "Standing sales only; a voided sale doesn't count.",
  status: {
    due: (due: string) => ({ lead: `${due} due.`, text: "Take a payment below when they pay some or all of it." }),
    paidUp: { lead: "Paid up.", text: "Nothing is owed." },
    credit: (credit: string) => ({
      lead: `${credit} in credit.`,
      text: "They paid for a sale that was voided since; it comes off what they buy next.",
    }),
  },
  contact: "Contact",
  phone: "Phone",
  email: "Email",
  note: "Note",
  sales: "Sales",
  dueOnSale: (amount: string) => `${amount} due`,
  newSale: "New sale",
  noSales: "No sales yet.",
  payments: "Payments",
  noPayments: "No payments yet.",
  atSale: (number: string) => `at ${number}`,
  by: (name: string) => `taken by ${name}`,

  // The form
  form: {
    newTitle: "New customer",
    editTitle: "Edit details",
    help: "Only the name is needed. A phone number makes a due easy to follow up.",
    name: "Name",
    phone: "Phone",
    email: "Email",
    note: "Note",
    noteHint: "Anything worth knowing when they buy: their usual order, who to ask for.",
    add: "Add customer",
    save: "Save changes",
    adding: "Adding…",
    saving: "Saving…",
    cancel: "Cancel",
    added: (name: string) => `Added ${name}`,
    saved: (name: string) => `Saved ${name}`,
  },

  // Taking a payment
  pay: {
    title: "Take a payment",
    amount: "Amount",
    amountHint: (due: string) => `Up to ${due}, what's due now.`,
    method: "Paid by",
    note: "Note",
    submit: "Take payment",
    saving: "Taking…",
    done: (amount: string, name: string) => `Took ${amount} from ${name}`,
    enterAmount: "Enter an amount, like 500.",
  },
  gone: "Customer updated.",
};

export type CustomersCopy = typeof en;

const bn: CustomersCopy = {
  title: "ক্রেতা",
  customerTitle: "ক্রেতা",
  addCustomer: "ক্রেতা যোগ করুন",
  allCustomers: "সব ক্রেতা",

  tallies: ["ক্রেতা", "আপনার পাওনা", "বাকি আছে"],
  columns: { name: "ক্রেতা", phone: "ফোন", sales: "বিক্রি", lastSale: "শেষ বিক্রি", due: "বাকি" },
  inCredit: (amount) => `${amount} জমা`,
  never: "এখনো বিক্রি নেই",
  empty: "এখনো কোনো ক্রেতা নেই।",
  emptyHelp: "এখানে বা নতুন বিক্রি থেকে যোগ করুন। ক্রেতা বাকিতে কিনে পরে দিতে পারেন।",

  labelTallies: ["কেনা", "দেওয়া", "বাকি"],
  standingNote: "শুধু বহাল বিক্রি; বাতিল বিক্রি ধরা হয় না।",
  status: {
    due: (due) => ({ lead: `বাকি ${due}।`, text: "কিছু বা পুরোটা দিলে নিচে পরিশোধ লিখুন।" }),
    paidUp: { lead: "সব শোধ।", text: "কিছু বাকি নেই।" },
    credit: (credit) => ({
      lead: `${credit} জমা।`,
      text: "পরে বাতিল হওয়া একটি বিক্রির টাকা দিয়েছিলেন; পরের কেনাকাটা থেকে বাদ যাবে।",
    }),
  },
  contact: "যোগাযোগ",
  phone: "ফোন",
  email: "ইমেইল",
  note: "নোট",
  sales: "বিক্রি",
  dueOnSale: (amount) => `বাকি ${amount}`,
  newSale: "নতুন বিক্রি",
  noSales: "এখনো বিক্রি নেই।",
  payments: "পরিশোধ",
  noPayments: "এখনো পরিশোধ নেই।",
  atSale: (number) => `${number}-এ`,
  by: (name) => `নিয়েছেন ${name}`,

  form: {
    newTitle: "নতুন ক্রেতা",
    editTitle: "বিবরণ সম্পাদনা",
    help: "শুধু নামটি লাগবে। ফোন নম্বর থাকলে বাকি আদায়ে সুবিধা হয়।",
    name: "নাম",
    phone: "ফোন",
    email: "ইমেইল",
    note: "নোট",
    noteHint: "কেনার সময় যা জানা কাজে লাগে: সাধারণ অর্ডার, কার সাথে কথা বলতে হবে।",
    add: "ক্রেতা যোগ করুন",
    save: "পরিবর্তন সংরক্ষণ",
    adding: "যোগ হচ্ছে…",
    saving: "সংরক্ষণ হচ্ছে…",
    cancel: "বাতিল",
    added: (name) => `${name} যোগ হলো`,
    saved: (name) => `${name} সংরক্ষিত`,
  },

  pay: {
    title: "পরিশোধ লিখুন",
    amount: "অঙ্ক",
    amountHint: (due) => `সর্বোচ্চ ${due}, এখন যা বাকি।`,
    method: "যেভাবে দেওয়া",
    note: "নোট",
    submit: "পরিশোধ লিখুন",
    saving: "লেখা হচ্ছে…",
    done: (amount, name) => `${name}-এর কাছ থেকে ${amount} নেওয়া হলো`,
    enterAmount: "একটি অঙ্ক লিখুন, যেমন 500।",
  },
  gone: "ক্রেতা হালনাগাদ হয়েছে।",
};

export const CUSTOMERS_COPY: Copy<CustomersCopy> = { en, bn };
