/**
 * One real exchange with the assistant, printed on the landing page as it happened.
 *
 * Asked of the live demo as the admin on 2026-11-24 (Worker version 31aea291, model
 * `@cf/zai-org/glm-4.7-flash`), against that morning's demo dataset. The question, the
 * lookups' summaries, the answer and the proposal are copied from the `/api/ask` events
 * word for word; nothing here is written for the page. Retake it, don't edit it: ask the
 * question again on the live demo and paste the new events.
 *
 * It was asked in English, so the Bangla page prints it in English too and says so.
 */

export const ASK_EXAMPLE = {
  askedOn: "2026-11-24",
  question: "What is running low at Greenfield Paper Goods, and what should I order?",
  steps: [
    { tool: "search_products", summary: "Searched products for “Greenfield Paper Goods”: 5 matches" },
    { tool: "draft_purchase_order", summary: "Proposed an order to Greenfield Paper Goods: 1 line, $1,189.50" },
  ],
  answer:
    "Copy paper A4, 500 sheets is running low with only 4 units on hand and will run out today. I've proposed an order for **305 units** from Greenfield Paper Goods at **$1,189.50**.",
  proposal: {
    supplierName: "Greenfield Paper Goods",
    lines: [{ sku: "OFC-PAPER-A4", name: "Copy paper A4, 500 sheets", quantity: 305, unitCostCents: 390, onHand: 4 }],
    totalCents: 118950,
  },
} as const;
