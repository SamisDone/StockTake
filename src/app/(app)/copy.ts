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
};

export const SHELL_COPY: Copy<typeof en> = { en, bn };
export type NavLabels = typeof en.nav;
