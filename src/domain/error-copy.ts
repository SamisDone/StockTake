import { formats } from "@/lib/format";
import type { Copy, Language } from "@/lib/i18n";

/**
 * What the domain says when it refuses something, in both languages. A refusal is
 * thrown as a key and its facts (`said(...)`), and printed in the reader's language at
 * the edge (Server Actions); `DomainError.message` keeps the English for logs and tests.
 * Zod schemas name a key as their message, so validation speaks both languages too.
 * Identifiers (PO numbers, SKUs) stay as printed; counts follow the language's digits.
 */

type Orders = { orders: string[] };

/** "PO-0001", "PO-0001 and PO-0002", "PO-0001, PO-0002 and PO-0003". */
const englishList = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const banglaList = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} ও ${items.at(-1)}`;

const n = formats("bn").count;

const en = {
  // Validation
  enterName: () => "Enter a name.",
  enterEmail: () => "Enter a valid email address.",
  passwordLength: () => "Use at least 12 characters.",
  enterPassword: () => "Enter your password.",
  notNegative: () => "Can't be negative.",
  moneyTooLarge: () => "Keep it to $1,000,000 or less.",
  quantityTooLarge: () => "Keep it to 1,000,000 or fewer.",
  skuFormat: () => "Use up to 32 letters, numbers, dots, dashes or underscores.",
  leadTimeTooLong: () => "Use 365 days or fewer.",
  starsRange: () => "Choose 1 to 5 stars.",
  addLine: () => "Add at least one line.",
  productOnce: () => "Each product can appear on an order once.",
  expectedBeforeToday: () => "The expected date can't be before today.",
  invalidValue: () => "That value isn't accepted.",

  // Missing records
  noProduct: () => "That product doesn't exist.",
  noProducts: () => "One of those products doesn't exist.",
  noSupplier: () => "That supplier doesn't exist.",
  noOrder: () => "That purchase order doesn't exist.",

  // Conflicts
  emailTaken: () => "Someone already uses that email.",
  skuTaken: () => "Another product already uses that SKU.",

  // Roles
  adminOnly: ({ action }: { action: AdminAction }) => `Only an admin can ${ADMIN_ACTIONS_EN[action]}.`,

  // Stock
  productArchivedStock: ({ product }: { product: string }) => `${product} is archived, so its stock can't change.`,
  notEnoughStock: ({ product, onHand }: { product: string; onHand: number }) => `Only ${onHand} × ${product} on hand.`,
  noMovement: () => "That ledger line doesn't exist.",
  noPerson: () => "That person isn't on the team.",
  notYourOwnRole: () => "You can't change your own role. Ask another admin.",
  resetYourOwn: () => "To change your own password, use Your password below.",
  demoAccountKept: () =>
    "The demo accounts stay as they are, so every visitor can sign in with them. Add a person to try this.",
  wrongCurrentPassword: () => "That isn't your current password.",
  undoNotYours: () => "Only the person who recorded a line can undo it.",
  undoTooLate: () => "It's too late to undo that line. Record a correction instead.",
  alreadyUndone: () => "That line has already been undone.",
  cantUndo: () => "Receipts and undos can't be undone here.",
  undoNotEnough: ({ product, onHand }: { product: string; onHand: number }) =>
    `Only ${onHand} × ${product} on hand now, so that line can't be undone. Record a count instead.`,

  // Catalog
  productOnOpenOrders: ({ product, orders }: { product: string } & Orders) =>
    orders.length === 1
      ? `${product} is on ${orders[0]}, which is still open. Receive or cancel it first.`
      : `${product} is on ${englishList(orders)}, which are still open. Receive or cancel them first.`,
  supplierHasOpenOrders: ({ supplier, orders }: { supplier: string } & Orders) =>
    `${supplier} has ${englishList(orders)} open. Receive or cancel ${orders.length === 1 ? "it" : "them"} first.`,
  supplierArchivedEdit: ({ supplier }: { supplier: string }) => `${supplier} is archived. Restore it to edit it.`,

  // Import
  importEmpty: () => "That file has no rows to import under its header line.",
  importTooLarge: () => "That file is over 500 KB. Split it into smaller files.",
  importTooMany: ({ max }: { max: number }) =>
    `Import up to ${max.toLocaleString("en-US")} products at a time. Split the file.`,
  importNoSku: () => "The first line needs a SKU column, so each row can be matched to a product.",
  importDuplicate: ({ sku, line }: { sku: string; line: number }) => `${sku} is on line ${line} too. Keep one of them.`,
  importArchived: ({ product }: { product: string }) => `${product} is archived. Restore it before importing it.`,
  importSupplierArchived: ({ supplier }: { supplier: string }) =>
    `${supplier} is archived. Restore it, or name another supplier.`,
  importMoney: () => "Write an amount in US dollars, like 12.50.",
  importUnits: () => "Write a whole number, like 24.",
  importChanged: () => "The catalog changed while you were checking. Choose the file again to see what's there now.",
  importNothing: () => "Nothing in this file changes the catalog.",

  // Orders
  supplierArchivedOrders: ({ supplier }: { supplier: string }) =>
    `${supplier} is archived, so it can't take new orders.`,
  productArchived: ({ product }: { product: string }) => `${product} is archived.`,
  notSupplied: ({ supplier, product }: { supplier: string; product: string }) =>
    `${supplier} doesn't supply ${product}.`,
  nothingToOrder: () => "Nothing from that supplier needs ordering right now.",
  allDrafted: ({ supplier }: { supplier: string }) => `Everything ${supplier} should send is on a draft already.`,
  noOrderLine: () => "That order line doesn't exist.",
  cancelPartly: ({ order }: { order: string }) =>
    `Part of ${order} has come in, so it can't be cancelled. Close it short instead.`,
  receiveNothing: () => "Enter how many came in for at least one line.",
  receiveTooMany: ({ product, left }: { product: string; left: number }) =>
    left === 0 ? `All of ${product} is in already.` : `Only ${left} more of ${product} is due on this order.`,
  receivedMeanwhile: ({ order }: { order: string }) =>
    `Someone received part of ${order} just now. Check what's still due and try again.`,
  nothingReceivedYet: ({ order }: { order: string }) =>
    `Nothing has come in on ${order} yet. If it isn't coming, cancel it instead.`,
  returnTooMany: ({ product, left }: { product: string; left: number }) =>
    left === 0
      ? `None of ${product} on this order is left to send back.`
      : `Only ${left} of ${product} came in on this order and can go back.`,
  returnState: ({ order }: { order: string }) => `Nothing has been received on ${order}, so nothing can go back on it.`,
  orderState: ({ order, status, operation }: { order: string; status: OrderStatus; operation: Operation }) =>
    (
      ({
        draft: { receive: `${order} hasn't been placed yet.` },
        ordered: {
          edit: `${order} has been placed, so it can't be edited.`,
          place: `${order} has been placed already.`,
        },
        received: {
          edit: `${order} has been received, so it can't be edited.`,
          place: `${order} has been received already.`,
          cancel: `${order} has been received, so it can't be cancelled.`,
          receive: `${order} has been received already.`,
        },
        cancelled: {
          edit: `${order} was cancelled, so it can't be edited.`,
          place: `${order} was cancelled, so it can't be placed.`,
          cancel: `${order} was cancelled already.`,
          receive: `${order} was cancelled, so it can't be received.`,
        },
      }) as Record<OrderStatus, Partial<Record<Operation, string>>>
    )[status][operation] ?? `${order} can't be changed right now.`,
};

const bn: typeof en = {
  enterName: () => "একটি নাম লিখুন।",
  enterEmail: () => "একটি সঠিক ইমেইল ঠিকানা লিখুন।",
  passwordLength: () => "অন্তত ১২টি অক্ষর ব্যবহার করুন।",
  enterPassword: () => "আপনার পাসওয়ার্ড লিখুন।",
  notNegative: () => "ঋণাত্মক হতে পারবে না।",
  moneyTooLarge: () => "$১০,০০,০০০ বা তার কম রাখুন।",
  quantityTooLarge: () => "১০,০০,০০০ বা তার কম রাখুন।",
  skuFormat: () => "অক্ষর, সংখ্যা, ডট, ড্যাশ বা আন্ডারস্কোর মিলিয়ে সর্বোচ্চ ৩২টি ব্যবহার করুন।",
  leadTimeTooLong: () => "৩৬৫ দিন বা তার কম লিখুন।",
  starsRange: () => "১ থেকে ৫ তারা বেছে নিন।",
  addLine: () => "অন্তত একটি লাইন যোগ করুন।",
  productOnce: () => "একটি অর্ডারে প্রতিটি পণ্য একবারই থাকতে পারে।",
  expectedBeforeToday: () => "প্রত্যাশিত তারিখ আজকের আগে হতে পারে না।",
  invalidValue: () => "এই মানটি গ্রহণযোগ্য নয়।",

  noProduct: () => "এই পণ্যটি নেই।",
  noProducts: () => "এর মধ্যে একটি পণ্য নেই।",
  noSupplier: () => "এই সরবরাহকারী নেই।",
  noOrder: () => "এই ক্রয় অর্ডারটি নেই।",

  emailTaken: () => "এই ইমেইল আগে থেকেই একজন ব্যবহার করছেন।",
  skuTaken: () => "এই SKU অন্য একটি পণ্যে ব্যবহার হচ্ছে।",

  adminOnly: ({ action }) => `শুধু অ্যাডমিন ${ADMIN_ACTIONS_BN[action]}।`,

  productArchivedStock: ({ product }) => `${product} আর্কাইভ করা, তাই এর স্টক বদলানো যাবে না।`,
  notEnoughStock: ({ product, onHand }) => `${product} মজুত আছে মাত্র ${n(onHand)}টি।`,
  noMovement: () => "খতিয়ানের এই লাইনটি নেই।",
  noPerson: () => "এই মানুষটি দলে নেই।",
  notYourOwnRole: () => "নিজের ভূমিকা নিজে বদলানো যায় না। অন্য একজন অ্যাডমিনকে বলুন।",
  resetYourOwn: () => "নিজের পাসওয়ার্ড বদলাতে নিচের “আপনার পাসওয়ার্ড” ব্যবহার করুন।",
  demoAccountKept: () =>
    "ডেমো অ্যাকাউন্টগুলো যেমন আছে তেমনই থাকে, যাতে সবাই সেগুলো দিয়ে সাইন ইন করতে পারেন। চেষ্টা করে দেখতে একজন নতুন মানুষ যোগ করুন।",
  wrongCurrentPassword: () => "এটি আপনার বর্তমান পাসওয়ার্ড নয়।",
  undoNotYours: () => "যিনি লাইনটি লিখেছেন, শুধু তিনিই এটি ফিরিয়ে নিতে পারেন।",
  undoTooLate: () => "এই লাইন ফিরিয়ে নেওয়ার সময় পেরিয়ে গেছে। বদলে একটি সংশোধন লিখুন।",
  alreadyUndone: () => "এই লাইনটি আগেই ফিরিয়ে নেওয়া হয়েছে।",
  cantUndo: () => "প্রাপ্তি আর ফিরিয়ে নেওয়া লাইন এখানে ফিরিয়ে নেওয়া যায় না।",
  undoNotEnough: ({ product, onHand }) =>
    `${product} এখন মজুত আছে মাত্র ${n(onHand)}টি, তাই লাইনটি ফিরিয়ে নেওয়া যাবে না। বদলে একটি গোনা লিখুন।`,

  productOnOpenOrders: ({ product, orders }) =>
    `${product} এখনো খোলা ${banglaList(orders)}-এ আছে। আগে ${orders.length === 1 ? "সেটি" : "সেগুলো"} বুঝে নিন বা বাতিল করুন।`,
  supplierHasOpenOrders: ({ supplier, orders }) =>
    `${supplier}-এর ${banglaList(orders)} এখনো খোলা। আগে ${orders.length === 1 ? "সেটি" : "সেগুলো"} বুঝে নিন বা বাতিল করুন।`,
  supplierArchivedEdit: ({ supplier }) => `${supplier} আর্কাইভ করা। সম্পাদনা করতে আগে ফিরিয়ে আনুন।`,

  importEmpty: () => "ফাইলের প্রথম লাইনের নিচে আনার মতো কোনো সারি নেই।",
  importTooLarge: () => "ফাইলটি ৫০০ KB-এর বেশি। কয়েকটি ছোট ফাইলে ভাগ করুন।",
  importTooMany: ({ max }) => `একবারে সর্বোচ্চ ${n(max)}টি পণ্য আনা যায়। ফাইলটি ভাগ করুন।`,
  importNoSku: () => "প্রথম লাইনে একটি SKU কলাম লাগবে, যাতে প্রতিটি সারি একটি পণ্যের সাথে মেলানো যায়।",
  importDuplicate: ({ sku, line }) => `${sku} লাইন ${n(line)}-এও আছে। একটি রাখুন।`,
  importArchived: ({ product }) => `${product} আর্কাইভ করা। আনার আগে ফিরিয়ে আনুন।`,
  importSupplierArchived: ({ supplier }) => `${supplier} আর্কাইভ করা। ফিরিয়ে আনুন, অথবা অন্য সরবরাহকারীর নাম দিন।`,
  importMoney: () => "মার্কিন ডলারে একটি অঙ্ক লিখুন, যেমন 12.50।",
  importUnits: () => "একটি পূর্ণ সংখ্যা লিখুন, যেমন 24।",
  importChanged: () => "দেখার মধ্যেই ক্যাটালগ বদলে গেছে। এখনকার অবস্থা দেখতে ফাইলটি আবার বেছে নিন।",
  importNothing: () => "এই ফাইলে ক্যাটালগের কিছুই বদলায় না।",

  supplierArchivedOrders: ({ supplier }) => `${supplier} আর্কাইভ করা, তাই নতুন অর্ডার নিতে পারবে না।`,
  productArchived: ({ product }) => `${product} আর্কাইভ করা।`,
  notSupplied: ({ supplier, product }) => `${supplier} ${product} সরবরাহ করে না।`,
  nothingToOrder: () => "এই সরবরাহকারীর কাছ থেকে এখন কিছু অর্ডার করার দরকার নেই।",
  allDrafted: ({ supplier }) => `${supplier}-এর কাছ থেকে যা আসার কথা, সবই আগে থেকে খসড়ায় আছে।`,
  noOrderLine: () => "এই অর্ডার লাইনটি নেই।",
  cancelPartly: ({ order }) => `${order}-এর কিছু অংশ এসে গেছে, তাই বাতিল করা যাবে না। বরং কম নিয়ে বন্ধ করুন।`,
  receiveNothing: () => "অন্তত একটি লাইনে কতগুলো এসেছে লিখুন।",
  receiveTooMany: ({ product, left }) =>
    left === 0 ? `${product}-এর সবটাই আগে এসে গেছে।` : `এই অর্ডারে ${product}-এর আর ${n(left)}টি আসার কথা।`,
  receivedMeanwhile: ({ order }) =>
    `এইমাত্র কেউ ${order}-এর কিছু অংশ বুঝে নিয়েছেন। কী বাকি আছে দেখে আবার চেষ্টা করুন।`,
  nothingReceivedYet: ({ order }) => `${order}-এ এখনো কিছু আসেনি। না এলে বরং বাতিল করুন।`,
  returnTooMany: ({ product, left }) =>
    left === 0
      ? `এই অর্ডারের ${product}-এর কিছুই ফেরত পাঠানোর মতো বাকি নেই।`
      : `এই অর্ডারে ${product}-এর ${n(left)}টি এসেছিল, সেগুলোই ফেরত যেতে পারে।`,
  returnState: ({ order }) => `${order}-এ কিছু বুঝে নেওয়া হয়নি, তাই কিছু ফেরতও যাবে না।`,
  orderState: ({ order, status, operation }) =>
    (
      ({
        draft: { receive: `${order} এখনো দেওয়া হয়নি।` },
        ordered: {
          edit: `${order} দেওয়া হয়ে গেছে, তাই সম্পাদনা করা যাবে না।`,
          place: `${order} আগেই দেওয়া হয়েছে।`,
        },
        received: {
          edit: `${order} বুঝে নেওয়া হয়ে গেছে, তাই সম্পাদনা করা যাবে না।`,
          place: `${order} আগেই বুঝে নেওয়া হয়েছে।`,
          cancel: `${order} বুঝে নেওয়া হয়ে গেছে, তাই বাতিল করা যাবে না।`,
          receive: `${order} আগেই বুঝে নেওয়া হয়েছে।`,
        },
        cancelled: {
          edit: `${order} বাতিল হয়েছে, তাই সম্পাদনা করা যাবে না।`,
          place: `${order} বাতিল হয়েছে, তাই দেওয়া যাবে না।`,
          cancel: `${order} আগেই বাতিল হয়েছে।`,
          receive: `${order} বাতিল হয়েছে, তাই বুঝে নেওয়া যাবে না।`,
        },
      }) as Record<OrderStatus, Partial<Record<Operation, string>>>
    )[status][operation] ?? `${order} এখন বদলানো যাবে না।`,
};

type OrderStatus = "draft" | "ordered" | "received" | "cancelled";
type Operation = "edit" | "place" | "cancel" | "receive";

export type AdminAction =
  | "addPeople"
  | "managePeople"
  | "addProducts"
  | "importProducts"
  | "editProducts"
  | "archiveProducts"
  | "restoreProducts"
  | "placeOrders"
  | "cancelOrders"
  | "closeOrders"
  | "addSuppliers"
  | "editSuppliers"
  | "archiveSuppliers"
  | "restoreSuppliers";

const ADMIN_ACTIONS_EN: Record<AdminAction, string> = {
  addPeople: "add people",
  managePeople: "change someone's role or password",
  addProducts: "add products",
  importProducts: "import products",
  editProducts: "edit products",
  archiveProducts: "archive products",
  restoreProducts: "restore products",
  placeOrders: "place purchase orders",
  cancelOrders: "cancel purchase orders",
  closeOrders: "close an order short",
  addSuppliers: "add suppliers",
  editSuppliers: "edit suppliers",
  archiveSuppliers: "archive suppliers",
  restoreSuppliers: "restore suppliers",
};

const ADMIN_ACTIONS_BN: Record<AdminAction, string> = {
  addPeople: "নতুন মানুষ যোগ করতে পারেন",
  managePeople: "কারও ভূমিকা বা পাসওয়ার্ড বদলাতে পারেন",
  addProducts: "পণ্য যোগ করতে পারেন",
  importProducts: "পণ্য আনতে পারেন",
  editProducts: "পণ্য সম্পাদনা করতে পারেন",
  archiveProducts: "পণ্য আর্কাইভ করতে পারেন",
  restoreProducts: "পণ্য ফিরিয়ে আনতে পারেন",
  placeOrders: "ক্রয় অর্ডার দিতে পারেন",
  cancelOrders: "ক্রয় অর্ডার বাতিল করতে পারেন",
  closeOrders: "অর্ডার কম নিয়ে বন্ধ করতে পারেন",
  addSuppliers: "সরবরাহকারী যোগ করতে পারেন",
  editSuppliers: "সরবরাহকারী সম্পাদনা করতে পারেন",
  archiveSuppliers: "সরবরাহকারী আর্কাইভ করতে পারেন",
  restoreSuppliers: "সরবরাহকারী ফিরিয়ে আনতে পারেন",
};

export const ERROR_COPY: Copy<typeof en> = { en, bn };

export type ErrorKey = keyof typeof en;

/** A refusal: which message, and the facts it's built from. Plain data, safe to send to a client. */
export type Said = { [K in ErrorKey]: { key: K; params: Parameters<(typeof en)[K]>[0] } }[ErrorKey];

/** A refusal by key: `said("notEnoughStock", { product, onHand })`. */
export function said<K extends ErrorKey>(key: K, ...params: Parameters<(typeof en)[K]>): Said {
  return { key, params: params[0] } as Said;
}

/** The refusal printed in `language`. */
export function sayIn(language: Language, { key, params }: Said): string {
  return (ERROR_COPY[language][key] as (p: typeof params) => string)(params);
}

export function isErrorKey(value: string): value is ErrorKey {
  return Object.hasOwn(en, value);
}
