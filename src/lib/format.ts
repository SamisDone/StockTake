const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats integer cents as dollars, e.g. 11300 → "$113.00". */
export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

const wholeMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Cents as whole dollars, for totals printed large, e.g. 182670 → "$1,827". */
export function formatWholeMoney(cents: number) {
  return wholeMoney.format(Math.round(cents / 100));
}

/** Days of cover: one decimal while it's short enough for tenths to matter, e.g. "3.4 days". */
export function formatDays(days: number) {
  const value = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${value} ${value === 1 ? "day" : "days"}`;
}

const count = new Intl.NumberFormat("en-US");

export function formatCount(n: number) {
  return count.format(n);
}
