import type { Copy } from "@/lib/i18n";

/** The app shell's words: the rail, the phone bar and the name tag. */

const en = {
  sections: "Sections",
  nav: {
    "/dashboard": "Dashboard",
    "/ask": "Ask",
    "/products": "Products",
    "/orders": "Orders",
    "/suppliers": "Suppliers",
    "/analytics": "Analytics",
    "/activity": "Activity",
  },
  signOut: "Sign out",

  // Record from anywhere and the command palette
  record: "Record",
  recordKey: "R",
  find: "Find",
  sheet: {
    title: "Record stock",
    help: "Find the product, then say what happened on the shelf.",
    search: "Product name or SKU",
    searchLabel: "Product",
    loading: "Loading products…",
    failed: "Couldn't load the products. Close this and try again.",
    noMatch: (query: string) => `No product matches “${query}”.`,
    onHand: (units: string) => `${units} on hand`,
    change: "Change",
    close: "Close",
  },
  palette: {
    title: "Find or do anything",
    search: "Search products, orders, suppliers, or type a command",
    loading: "Loading…",
    noMatch: (query: string) => `Nothing matches “${query}”.`,
    groups: { actions: "Do", pages: "Go to", products: "Products", orders: "Orders", suppliers: "Suppliers" },
    recordStock: "Record stock",
    newOrder: "New purchase order",
    newProduct: "New product",
    newSupplier: "New supplier",
    switchLanguage: "বাংলায় দেখুন",
    switchCurrency: (taka: boolean): string => (taka ? "Show money in dollars" : "Show money in taka"),
    onHand: (units: string) => `${units} on hand`,
  },
};

const bn: typeof en = {
  sections: "বিভাগ",
  nav: {
    "/dashboard": "ড্যাশবোর্ড",
    "/ask": "জিজ্ঞাসা",
    "/products": "পণ্য",
    "/orders": "অর্ডার",
    "/suppliers": "সরবরাহকারী",
    "/analytics": "বিশ্লেষণ",
    "/activity": "কার্যক্রম",
  },
  signOut: "সাইন আউট",

  record: "লিখুন",
  recordKey: "R",
  find: "খুঁজুন",
  sheet: {
    title: "স্টক লিখুন",
    help: "পণ্যটি খুঁজুন, তারপর তাকে কী হলো লিখুন।",
    search: "পণ্যের নাম বা SKU",
    searchLabel: "পণ্য",
    loading: "পণ্য আসছে…",
    failed: "পণ্যগুলো আনা গেল না। এটি বন্ধ করে আবার চেষ্টা করুন।",
    noMatch: (query) => `“${query}”-এর সাথে কোনো পণ্য মেলেনি।`,
    onHand: (units) => `মজুত ${units}`,
    change: "বদলান",
    close: "বন্ধ করুন",
  },
  palette: {
    title: "যেকোনো কিছু খুঁজুন বা করুন",
    search: "পণ্য, অর্ডার, সরবরাহকারী খুঁজুন, বা একটি কাজ লিখুন",
    loading: "আসছে…",
    noMatch: (query) => `“${query}”-এর সাথে কিছু মেলেনি।`,
    groups: { actions: "করুন", pages: "যান", products: "পণ্য", orders: "অর্ডার", suppliers: "সরবরাহকারী" },
    recordStock: "স্টক লিখুন",
    newOrder: "নতুন ক্রয় অর্ডার",
    newProduct: "নতুন পণ্য",
    newSupplier: "নতুন সরবরাহকারী",
    switchLanguage: "Show in English",
    switchCurrency: (taka) => (taka ? "টাকার বদলে ডলারে দেখুন" : "ডলারের বদলে টাকায় দেখুন"),
    onHand: (units) => `মজুত ${units}`,
  },
};

export const SHELL_COPY: Copy<typeof en> = { en, bn };
export type NavLabels = typeof en.nav;
