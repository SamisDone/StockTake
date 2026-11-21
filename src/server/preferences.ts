import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getRate, isStale, readCurrency, refreshRate } from "@/domain/exchange";
import { type Language, readLanguage } from "@/lib/i18n";
import type { MoneyPrefs } from "@/lib/money";
import { CURRENCY_COOKIE, LANGUAGE_COOKIE } from "./preference-cookie";

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

/**
 * The language this person reads Stocktake in. Only a cookie, so it costs nothing to read
 * and the shell can print its labels without waiting on the database.
 */
export const getLanguage = cache(async (): Promise<Language> =>
  readLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value),
);
