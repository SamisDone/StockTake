import type { StockForecast } from "@/domain/forecast";
import { DEMAND_WINDOW_DAYS } from "@/domain/forecast";
import { formats } from "./format";
import type { Language } from "./i18n";

type Facts = Pick<
  StockForecast,
  "status" | "onHand" | "onOrder" | "dailyDemand" | "leadTimeDays" | "reorderPoint" | "supplierName"
>;

/**
 * Why a product has the status it has, in one sentence built from the same numbers
 * the forecast used. A status nobody can check is a status nobody trusts.
 */
export function explainStock(f: Facts, language: Language = "en"): string {
  return language === "bn" ? bangla(f) : english(f);
}

function english(f: Facts) {
  const { count, days, rate } = formats("en");
  const position = f.onHand + f.onOrder;
  const stock =
    f.onOrder > 0 ? `${count(f.onHand)} on hand and ${count(f.onOrder)} on order` : `${count(f.onHand)} on hand`;
  // A non-breaking hyphen, so "14‑day" never splits across lines.
  const lead = f.supplierName
    ? `the ${f.leadTimeDays}‑day lead time`
    : `the ${f.leadTimeDays}‑day lead time assumed without a supplier`;
  const lasts = f.dailyDemand > 0 ? `lasts ${days(position / f.dailyDemand)} at ${rate(f.dailyDemand)}` : "";

  if (f.status === "out") {
    return f.onOrder > 0
      ? `None on hand, and ${count(f.onOrder)} on order not yet received.`
      : "None on hand, and none on order.";
  }
  if (f.status === "reorder") {
    if (position <= f.reorderPoint) {
      return `${capitalize(stock)} is at or below the reorder point of ${count(f.reorderPoint)}.`;
    }
    return `${capitalize(stock)} ${lasts}, short of ${lead}: a new order wouldn't arrive in time.`;
  }
  if (f.dailyDemand === 0) {
    return `No sales in the last ${DEMAND_WINDOW_DAYS} days, and ${stock} is above the reorder point of ${count(f.reorderPoint)}.`;
  }
  return `${capitalize(stock)} ${lasts}, past ${lead}.`;
}

function bangla(f: Facts) {
  const { count, days } = formats("bn");
  const position = f.onHand + f.onOrder;
  const stock = f.onOrder > 0 ? `মজুত ${count(f.onHand)} আর অর্ডারে ${count(f.onOrder)}` : `মজুত ${count(f.onHand)}`;
  const lead = f.supplierName
    ? `${count(f.leadTimeDays)} দিনের সরবরাহ সময়`
    : `সরবরাহকারী না থাকায় ধরে নেওয়া ${count(f.leadTimeDays)} দিনের সরবরাহ সময়`;
  const pace = (n: number) => `দিনে ${formats("bn").count(Math.round(n * 10) / 10)}টি`;
  const lasts = f.dailyDemand > 0 ? `${pace(f.dailyDemand)} বিক্রিতে চলবে ${days(position / f.dailyDemand)}` : "";

  if (f.status === "out") {
    return f.onOrder > 0 ? `মজুত নেই, অর্ডারে থাকা ${count(f.onOrder)}টি এখনো আসেনি।` : "মজুত নেই, অর্ডারেও নেই।";
  }
  if (f.status === "reorder") {
    if (position <= f.reorderPoint) {
      return `${stock}, যা পুনঃঅর্ডার সীমা ${count(f.reorderPoint)}-এর সমান বা কম।`;
    }
    return `${stock}, ${lasts}, যা ${lead}-এর চেয়ে কম: এখন অর্ডার দিলেও সময়মতো পৌঁছাবে না।`;
  }
  if (f.dailyDemand === 0) {
    return `গত ${count(DEMAND_WINDOW_DAYS)} দিনে কোনো বিক্রি নেই, আর ${stock}, যা পুনঃঅর্ডার সীমা ${count(f.reorderPoint)}-এর ওপরে।`;
  }
  return `${stock}, ${lasts}, যা ${lead} পেরিয়ে যায়।`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
