const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats integer cents as dollars, e.g. 11300 → "$113.00". */
export function formatMoney(cents: number) {
  return money.format(cents / 100);
}
