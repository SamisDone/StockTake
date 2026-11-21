import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { exchangeRates } from "@/db/schema";
import type { Currency } from "@/lib/money";

/**
 * The US dollar to taka rate. Money is stored in US cents; taka is a conversion for
 * people who read in it. The rate comes from a free, keyless public source that
 * publishes daily (fawazahmed0/exchange-api, CC0), mirrored on two hosts. It's kept in
 * the database so pages read it in one query and never wait on the source: a stale rate
 * is refreshed in the background, and the last good one stays until a new one arrives.
 */

export const RATE_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
];

/** The source publishes once a day; checking every six hours picks a new rate up the same morning. */
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

export type Rate = { perUsd: number; asOf: string; fetchedAt: Date };

/** Used only if the table is somehow empty: the source's rate on 2026-11-20. */
const FALLBACK: Rate = { perUsd: 124.6563, asOf: "2026-11-20", fetchedAt: new Date(0) };

export function readCurrency(value: string | undefined): Currency {
  return value === "BDT" ? "BDT" : "USD";
}

export async function getRate(db: Database): Promise<Rate> {
  const [row] = await db.select().from(exchangeRates).where(eq(exchangeRates.currency, "BDT"));
  return row ? { perUsd: row.perUsd, asOf: row.asOf, fetchedAt: row.fetchedAt } : FALLBACK;
}

export const isStale = (rate: Rate, now: Date) => now.getTime() - rate.fetchedAt.getTime() >= REFRESH_AFTER_MS;

const published = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usd: z.object({ bdt: z.number().positive().finite() }),
});

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetches today's rate and stores it. Tries each mirror in turn. A response that isn't
 * the expected shape, or a rate more than double or less than half the last one, is
 * ignored: a bad figure would misprice every page. Returns the stored rate, or null when
 * no source gave a usable one (the previous rate stays).
 */
export async function refreshRate(db: Database, fetchRate: Fetch, now: Date): Promise<Rate | null> {
  const previous = await getRate(db);
  for (const url of RATE_SOURCES) {
    try {
      const response = await fetchRate(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const parsed = published.safeParse(await response.json());
      if (!parsed.success) continue;
      const perUsd = parsed.data.usd.bdt;
      if (perUsd > previous.perUsd * 2 || perUsd < previous.perUsd / 2) continue;
      const rate: Rate = { perUsd, asOf: parsed.data.date, fetchedAt: now };
      await db
        .insert(exchangeRates)
        .values({ currency: "BDT", ...rate })
        .onConflictDoUpdate({ target: exchangeRates.currency, set: rate });
      return rate;
    } catch {
      // A mirror that's down or slow: try the next one.
    }
  }
  return null;
}
