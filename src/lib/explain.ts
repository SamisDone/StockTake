import type { StockForecast } from "@/domain/forecast";
import { DEMAND_WINDOW_DAYS } from "@/domain/forecast";
import { formatCount, formatDays, formatRate } from "./format";

type Facts = Pick<
  StockForecast,
  "status" | "onHand" | "onOrder" | "dailyDemand" | "leadTimeDays" | "reorderPoint" | "supplierName"
>;

/**
 * Why a product has the status it has, in one sentence built from the same numbers
 * the forecast used. A status nobody can check is a status nobody trusts.
 */
export function explainStock(f: Facts): string {
  const position = f.onHand + f.onOrder;
  const stock =
    f.onOrder > 0
      ? `${formatCount(f.onHand)} on hand and ${formatCount(f.onOrder)} on order`
      : `${formatCount(f.onHand)} on hand`;
  // A non-breaking hyphen, so "14‑day" never splits across lines.
  const lead = f.supplierName
    ? `the ${f.leadTimeDays}‑day lead time`
    : `the ${f.leadTimeDays}‑day lead time assumed without a supplier`;
  const lasts =
    f.dailyDemand > 0 ? `lasts ${formatDays(position / f.dailyDemand)} at ${formatRate(f.dailyDemand)}` : "";

  if (f.status === "out") {
    return f.onOrder > 0
      ? `None on hand, and ${formatCount(f.onOrder)} on order not yet received.`
      : "None on hand, and none on order.";
  }
  if (f.status === "reorder") {
    if (position <= f.reorderPoint) {
      return `${capitalize(stock)} is at or below the reorder point of ${formatCount(f.reorderPoint)}.`;
    }
    return `${capitalize(stock)} ${lasts}, short of ${lead}: a new order wouldn't arrive in time.`;
  }
  if (f.dailyDemand === 0) {
    return `No sales in the last ${DEMAND_WINDOW_DAYS} days, and ${stock} is above the reorder point of ${formatCount(f.reorderPoint)}.`;
  }
  return `${capitalize(stock)} ${lasts}, past ${lead}.`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
