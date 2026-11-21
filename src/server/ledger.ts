import "server-only";
import type { Database } from "@/db/database";
import { poNumber } from "@/domain/purchase-orders";
import { type LedgerCursor, listMovements } from "@/domain/stock";

/** How many movements the ledger prints at a time: the newest, then each "Show older". */
export const LEDGER_PAGE = 20;

/** A page of a product's ledger, shaped for the client: the PO number already printed. */
export async function ledgerPage(db: Database, productId: number, before?: LedgerCursor) {
  const movements = await listMovements(db, productId, { limit: LEDGER_PAGE, before });
  return movements.map(({ purchaseOrderId, ...move }) => ({
    ...move,
    po: purchaseOrderId ? poNumber(purchaseOrderId) : null,
  }));
}

export type LedgerEntry = Awaited<ReturnType<typeof ledgerPage>>[number];
