/**
 * One real exchange with the assistant, printed on the landing page as it happened.
 *
 * Asked of the live demo as the admin on 2026-11-24 (Worker version 77ad9a48, model
 * `@cf/zai-org/glm-4.7-flash`), against that morning's demo dataset. The question, the
 * lookups' summaries, the answer and the proposal are copied from the `/api/ask` events
 * word for word; nothing here is written for the page. Retake it, don't edit it: ask the
 * question again on the live demo and paste the new events.
 *
 * It was asked in English, so the Bangla page prints it in English too and says so.
 */

export const ASK_EXAMPLE = {
  askedOn: "2026-11-24",
  question: "What is running low at Sonargaon Paper House, and what should I order?",
  steps: [
    { tool: "search_products", summary: "Searched products for “Sonargaon Paper House”: 5 matches" },
    { tool: "draft_purchase_order", summary: "Proposed an order to Sonargaon Paper House: 1 line, $936.00" },
  ],
  answer:
    "Copy paper A4, 500 sheets is out of stock and needs **240** units. Sticky notes, 12 pads will run out on Nov 27 and could use **120** units. Address labels, 300 will run out on Nov 28. I've proposed an order for the out-of-stock copy paper.",
  proposal: {
    supplierName: "Sonargaon Paper House",
    lines: [{ sku: "OFC-PAPER-A4", name: "Copy paper A4, 500 sheets", quantity: 240, unitCostCents: 390, onHand: 0 }],
    totalCents: 93600,
  },
} as const;
