import { formats } from "@/lib/format";
import type { Copy } from "@/lib/i18n";

/** The People page's words, in both languages. */

const en = {
  title: "People",
  intro:
    "Who can sign in, and as what. Admins look after the catalog, suppliers, orders and people; staff record stock and receive deliveries.",
  demoNote:
    "The two demo accounts stay as they are, so every visitor can sign in with them. Add a person to try roles and password resets.",
  staffNote: "Only an admin can add people or change a role or password.",
  roles: { admin: "Admin", staff: "Staff" },
  you: "You",
  demo: "Demo account",
  added: (day: string) => `Added ${day}`,
  makeAdmin: "Make admin",
  makeStaff: "Make staff",
  changing: "Changing…",
  reset: "Reset password",
  resetting: "Resetting…",
  confirmReset: (name: string) => `Reset ${name}'s password? They're signed out everywhere until they use the new one.`,
  keep: "Keep it",
  team: "The team",
  count: (n: number) => `${formats("en").count(n)} ${n === 1 ? "person" : "people"}`,

  addTitle: "Add a person",
  addHelp:
    "They get a temporary password to sign in with, shown here once for you to hand over. There's no email: tell them in person.",
  name: "Name",
  email: "Email",
  role: "Role",
  roleHelp: { admin: "Everything, including people.", staff: "Records stock and receives deliveries." },
  add: "Add person",
  adding: "Adding…",

  handover: (name: string) => `Give ${name} this password:`,
  handoverHelp: "It's shown once. After signing in they can change it under Your password on this page.",
  copy: "Copy",
  copied: "Copied",
  done: "Done",

  yourTitle: "Your password",
  yourHelp: "At least 12 characters. Your other devices are signed out; this one stays signed in.",
  yourDemo: "You're signed in with a demo account, whose password is public and stays as it is.",
  current: "Current password",
  next: "New password",
  show: "Show",
  hide: "Hide",
  showPassword: (label: string) => `Show ${label.toLowerCase()}`,
  change: "Change password",
  changingPassword: "Changing…",
};

const bn: typeof en = {
  title: "দল",
  intro:
    "কে সাইন ইন করতে পারেন, আর কোন ভূমিকায়। অ্যাডমিন পণ্য, সরবরাহকারী, অর্ডার আর দলের মানুষ দেখেন; কর্মীরা স্টক লেখেন আর ডেলিভারি বুঝে নেন।",
  demoNote:
    "দুটি ডেমো অ্যাকাউন্ট যেমন আছে তেমনই থাকে, যাতে সবাই সেগুলো দিয়ে সাইন ইন করতে পারেন। ভূমিকা আর পাসওয়ার্ড বদল চেষ্টা করতে একজন নতুন মানুষ যোগ করুন।",
  staffNote: "শুধু অ্যাডমিন নতুন মানুষ যোগ করতে বা কারও ভূমিকা কিংবা পাসওয়ার্ড বদলাতে পারেন।",
  roles: { admin: "অ্যাডমিন", staff: "কর্মী" },
  you: "আপনি",
  demo: "ডেমো অ্যাকাউন্ট",
  added: (day) => `যোগ হয়েছেন ${day}`,
  makeAdmin: "অ্যাডমিন করুন",
  makeStaff: "কর্মী করুন",
  changing: "বদলানো হচ্ছে…",
  reset: "পাসওয়ার্ড নতুন করুন",
  resetting: "নতুন করা হচ্ছে…",
  confirmReset: (name) =>
    `${name}-এর পাসওয়ার্ড নতুন করবেন? নতুনটি দিয়ে সাইন ইন না করা পর্যন্ত সব জায়গা থেকে তিনি সাইন আউট থাকবেন।`,
  keep: "থাক",
  team: "দলের মানুষ",
  count: (n) => `${formats("bn").count(n)} জন`,

  addTitle: "নতুন মানুষ যোগ করুন",
  addHelp:
    "সাইন ইনের জন্য তিনি একটি অস্থায়ী পাসওয়ার্ড পাবেন, যা এখানে একবারই দেখানো হবে। ইমেইল যায় না: সরাসরি জানিয়ে দিন।",
  name: "নাম",
  email: "ইমেইল",
  role: "ভূমিকা",
  roleHelp: { admin: "সব কিছু, দলের মানুষসহ।", staff: "স্টক লেখেন আর ডেলিভারি বুঝে নেন।" },
  add: "যোগ করুন",
  adding: "যোগ করা হচ্ছে…",

  handover: (name) => `${name}-কে এই পাসওয়ার্ডটি দিন:`,
  handoverHelp: "এটি একবারই দেখানো হবে। সাইন ইনের পর তিনি এই পাতার “আপনার পাসওয়ার্ড” থেকে এটি বদলাতে পারবেন।",
  copy: "কপি",
  copied: "কপি হয়েছে",
  done: "হয়েছে",

  yourTitle: "আপনার পাসওয়ার্ড",
  yourHelp: "অন্তত ১২টি অক্ষর। আপনার অন্য ডিভাইসগুলো সাইন আউট হবে; এটি সাইন ইন থাকবে।",
  yourDemo: "আপনি ডেমো অ্যাকাউন্টে সাইন ইন করেছেন, যার পাসওয়ার্ড সবার জানা এবং বদলায় না।",
  current: "বর্তমান পাসওয়ার্ড",
  next: "নতুন পাসওয়ার্ড",
  show: "দেখান",
  hide: "লুকান",
  showPassword: (label) => `${label} দেখান`,
  change: "পাসওয়ার্ড বদলান",
  changingPassword: "বদলানো হচ্ছে…",
};

export const PEOPLE_COPY: Copy<typeof en> = { en, bn };
export type PeopleCopy = typeof en;
