import { formats } from "@/lib/format";
import type { Copy, Language } from "@/lib/i18n";
import { DOLLARS, moneyFormat } from "@/lib/money";

/**
 * What each kind of activity entry says, written from the entry's facts. The English
 * sentence is stored as the entry's summary, the record as it was written; the facts are
 * stored beside it, so the feed can print the entry in the reader's language. Amounts
 * stay in the dollars they were recorded in.
 */
export type ActivityEvent =
  | { action: "user.created"; facts: { name: string; role: "admin" | "staff" } }
  | { action: "user.role_changed"; facts: { name: string; role: "admin" | "staff" } }
  | { action: "user.password_reset" | "user.password_changed"; facts: { name: string } }
  | { action: "product.created"; facts: { name: string; sku: string } }
  | { action: "product.updated" | "product.archived" | "product.restored"; facts: { name: string } }
  | {
      action: "supplier.created" | "supplier.updated" | "supplier.archived" | "supplier.restored";
      facts: { name: string };
    }
  | { action: "supplier.reviewed"; facts: { name: string; rating: number } }
  | {
      action: "stock.sale" | "stock.return" | "stock.write_off";
      facts: { name: string; quantity: number; note?: string };
    }
  | { action: "stock.counted"; facts: { name: string; counted: number; was: number; note?: string } }
  | { action: "stock.undone"; facts: { name: string; undid: UndoneKind; quantity: number } }
  | { action: "purchase_order.drafted"; facts: { supplier: string; lines: number; totalCents: number } }
  | { action: "purchase_order.edited"; facts: { order: string; lines: number; totalCents: number } }
  | { action: "purchase_order.placed"; facts: { order: string; supplier: string; totalCents: number } }
  | { action: "purchase_order.cancelled"; facts: { order: string } }
  | { action: "purchase_order.received"; facts: { order: string; supplier: string; units: number } }
  | { action: "purchase_order.received_part"; facts: { order: string; supplier: string; units: number } }
  | { action: "purchase_order.closed_short"; facts: { order: string; supplier: string; short: number } }
  | {
      action: "stock.supplier_return";
      facts: { name: string; quantity: number; order: string; supplier: string; note?: string };
    };

/** What an undo reversed: a recorded movement's kind ("adjustment" is a count's). */
export type UndoneKind = "sale" | "return" | "write_off" | "adjustment";

type Action = ActivityEvent["action"];
type FactsOf<A extends Action> = Extract<ActivityEvent, { action: A }>["facts"];
type Sentences = { [A in Action]: (facts: FactsOf<A>) => string };

const withNote = (text: string, note?: string) => (note ? `${text}: ${note}` : text);

const enDollars = moneyFormat(DOLLARS).money;
const en: Sentences = {
  "user.created": ({ name, role }) => `Added ${name} as ${role}`,
  "user.role_changed": ({ name, role }) => `Made ${name} ${role === "admin" ? "an admin" : "staff"}`,
  "user.password_reset": ({ name }) => `Reset ${name}'s password`,
  "user.password_changed": ({ name }) => `${name} changed their password`,
  "product.created": ({ name, sku }) => `Added ${name} (${sku})`,
  "product.updated": ({ name }) => `Updated ${name}`,
  "product.archived": ({ name }) => `Archived ${name}`,
  "product.restored": ({ name }) => `Restored ${name}`,
  "supplier.created": ({ name }) => `Added supplier ${name}`,
  "supplier.updated": ({ name }) => `Updated ${name}`,
  "supplier.archived": ({ name }) => `Archived ${name}`,
  "supplier.restored": ({ name }) => `Restored ${name}`,
  "supplier.reviewed": ({ name, rating }) => `Rated ${name} ${rating}/5`,
  "stock.sale": ({ name, quantity, note }) => withNote(`Sold ${quantity} × ${name}`, note),
  "stock.return": ({ name, quantity, note }) => withNote(`Took back a return of ${quantity} × ${name}`, note),
  "stock.write_off": ({ name, quantity, note }) => withNote(`Wrote off ${quantity} × ${name}`, note),
  "stock.counted": ({ name, counted, was, note }) =>
    withNote(
      counted === was ? `Counted ${counted} × ${name}, which matches` : `Counted ${counted} × ${name} (was ${was})`,
      note,
    ),
  "stock.undone": ({ name, undid, quantity }) =>
    ({
      sale: `Undid a sale of ${quantity} × ${name}`,
      return: `Undid a return of ${quantity} × ${name}`,
      write_off: `Undid a write-off of ${quantity} × ${name}`,
      adjustment: `Undid a count's change of ${quantity} × ${name}`,
    })[undid],
  "purchase_order.drafted": ({ supplier, lines, totalCents }) =>
    `Drafted an order with ${supplier}: ${lines} ${lines === 1 ? "line" : "lines"}, ${enDollars(totalCents)}`,
  "purchase_order.edited": ({ order, lines, totalCents }) =>
    `Edited ${order}: ${lines} ${lines === 1 ? "line" : "lines"}, ${enDollars(totalCents)}`,
  "purchase_order.placed": ({ order, supplier, totalCents }) =>
    `Placed ${order} with ${supplier} for ${enDollars(totalCents)}`,
  "purchase_order.cancelled": ({ order }) => `Cancelled ${order}`,
  "purchase_order.received": ({ order, supplier, units }) => `Received ${order} from ${supplier}: ${units} units`,
  "purchase_order.received_part": ({ order, supplier, units }) =>
    `Received part of ${order} from ${supplier}: ${units} units`,
  "purchase_order.closed_short": ({ order, supplier, short }) =>
    `Closed ${order} from ${supplier} short: ${short} units never came`,
  "stock.supplier_return": ({ name, quantity, order, supplier, note }) =>
    withNote(`Sent ${quantity} × ${name} back to ${supplier} on ${order}`, note),
};

const n = formats("bn").count;
const bnDollars = moneyFormat(DOLLARS, "bn").money;
const bn: Sentences = {
  "user.created": ({ name, role }) => `${name}-কে ${role === "admin" ? "অ্যাডমিন" : "কর্মী"} হিসেবে যোগ করা হলো`,
  "user.role_changed": ({ name, role }) => `${name}-কে ${role === "admin" ? "অ্যাডমিন" : "কর্মী"} করা হলো`,
  "user.password_reset": ({ name }) => `${name}-এর পাসওয়ার্ড নতুন করে দেওয়া হলো`,
  "user.password_changed": ({ name }) => `${name} নিজের পাসওয়ার্ড বদলালেন`,
  "product.created": ({ name, sku }) => `${name} (${sku}) যোগ করা হলো`,
  "product.updated": ({ name }) => `${name} হালনাগাদ করা হলো`,
  "product.archived": ({ name }) => `${name} আর্কাইভ করা হলো`,
  "product.restored": ({ name }) => `${name} ফিরিয়ে আনা হলো`,
  "supplier.created": ({ name }) => `সরবরাহকারী ${name} যোগ করা হলো`,
  "supplier.updated": ({ name }) => `${name} হালনাগাদ করা হলো`,
  "supplier.archived": ({ name }) => `${name} আর্কাইভ করা হলো`,
  "supplier.restored": ({ name }) => `${name} ফিরিয়ে আনা হলো`,
  "supplier.reviewed": ({ name, rating }) => `${name}-কে ৫-এ ${n(rating)} রেটিং দেওয়া হলো`,
  "stock.sale": ({ name, quantity, note }) => withNote(`${n(quantity)} × ${name} বিক্রি`, note),
  "stock.return": ({ name, quantity, note }) => withNote(`${n(quantity)} × ${name} ফেরত নেওয়া হলো`, note),
  "stock.write_off": ({ name, quantity, note }) => withNote(`${n(quantity)} × ${name} বাতিল করা হলো`, note),
  "stock.counted": ({ name, counted, was, note }) =>
    withNote(
      counted === was
        ? `${name} গোনা হলো ${n(counted)}টি, হিসাবের সাথে মিলেছে`
        : `${name} গোনা হলো ${n(counted)}টি (আগে ছিল ${n(was)})`,
      note,
    ),
  "stock.undone": ({ name, undid, quantity }) =>
    ({
      sale: `${n(quantity)} × ${name} বিক্রি ফিরিয়ে নেওয়া হলো`,
      return: `${n(quantity)} × ${name} ফেরত ফিরিয়ে নেওয়া হলো`,
      write_off: `${n(quantity)} × ${name} বাতিল ফিরিয়ে নেওয়া হলো`,
      adjustment: `গোনার ${n(quantity)} × ${name} বদল ফিরিয়ে নেওয়া হলো`,
    })[undid],
  "purchase_order.drafted": ({ supplier, lines, totalCents }) =>
    `${supplier}-এর জন্য অর্ডারের খসড়া: ${n(lines)} লাইন, ${bnDollars(totalCents)}`,
  "purchase_order.edited": ({ order, lines, totalCents }) =>
    `${order} সম্পাদনা: ${n(lines)} লাইন, ${bnDollars(totalCents)}`,
  "purchase_order.placed": ({ order, supplier, totalCents }) =>
    `${supplier}-কে ${bnDollars(totalCents)}-এর ${order} দেওয়া হলো`,
  "purchase_order.cancelled": ({ order }) => `${order} বাতিল হলো`,
  "purchase_order.received": ({ order, supplier, units }) =>
    `${supplier}-এর কাছ থেকে ${order} বুঝে নেওয়া হলো: ${n(units)} ইউনিট`,
  "purchase_order.received_part": ({ order, supplier, units }) =>
    `${supplier}-এর কাছ থেকে ${order}-এর কিছু অংশ বুঝে নেওয়া হলো: ${n(units)} ইউনিট`,
  "purchase_order.closed_short": ({ order, supplier, short }) =>
    `${supplier}-এর ${order} কম নিয়েই বন্ধ করা হলো: ${n(short)} ইউনিট আসেনি`,
  "stock.supplier_return": ({ name, quantity, order, supplier, note }) =>
    withNote(`${order}-এর ${n(quantity)} × ${name} ${supplier}-কে ফেরত পাঠানো হলো`, note),
};

const SENTENCES: Copy<Sentences> = { en, bn };

/** The entry in words: `language`'s sentence for its facts. */
export function describeActivity(language: Language, event: ActivityEvent): string {
  return (SENTENCES[language][event.action] as (facts: ActivityEvent["facts"]) => string)(event.facts);
}

/**
 * A stored entry in the reader's language: its facts' sentence, or the summary it was
 * recorded with when it has no facts (written before they were kept) or a kind this
 * code doesn't know.
 */
export function activityText(
  language: Language,
  entry: { action: string; summary: string; facts: Record<string, unknown> | null },
): string {
  if (!entry.facts || !Object.hasOwn(SENTENCES.en, entry.action)) return entry.summary;
  try {
    return describeActivity(language, { action: entry.action, facts: entry.facts } as ActivityEvent);
  } catch {
    return entry.summary;
  }
}
