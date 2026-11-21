import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getRate, isStale, readCurrency, refreshRate } from "@/domain/exchange";
import type { MoneyPrefs } from "@/lib/money";

export const CURRENCY_COOKIE = "currency";

/** A preference cookie: a year long, readable by the server only, sent on same-site navigation. */
export function preferenceCookie(name: string, value: string) {
  return {
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  };
}

/**
 * How this person reads money: their currency and today's taka rate. Read once per
 * request. A stale rate is refreshed after the response is sent, so no page waits on the
 * rate source; until then the last good rate is used.
 */
export const getMoneyPrefs = cache(async (): Promise<MoneyPrefs> => {
  const currency = readCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  await connection();
  const db = await getDb();
  const rate = await getRate(db);
  const now = new Date();
  if (isStale(rate, now)) {
    const refreshing = refreshRate(db, fetch, now).catch(() => null);
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(refreshing);
  }
  return { currency, bdtPerUsd: rate.perUsd, rateAsOf: rate.asOf };
});
