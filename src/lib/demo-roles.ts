import type { Copy } from "./i18n";

type Seat = { role: "admin" | "staff"; label: string; duty: string };

/** The public demo's two seats, as the login label and the landing page present them. */
export const DEMO_ROLES: Copy<readonly Seat[]> = {
  en: [
    { role: "admin", label: "Admin", duty: "Catalog, suppliers and purchasing" },
    { role: "staff", label: "Staff", duty: "Counts, sales and receiving" },
  ],
  bn: [
    { role: "admin", label: "অ্যাডমিন", duty: "পণ্যতালিকা, সরবরাহকারী ও কেনাকাটা" },
    { role: "staff", label: "কর্মী", duty: "গণনা, বিক্রি ও মাল বুঝে নেওয়া" },
  ],
};

/** A role as the app names it: "Admin" or "Staff", "অ্যাডমিন" or "কর্মী". */
export const ROLE_NAMES: Copy<Record<Seat["role"], string>> = {
  en: { admin: "Admin", staff: "Staff" },
  bn: { admin: "অ্যাডমিন", staff: "কর্মী" },
};
