"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { readCurrency } from "@/domain/exchange";
import { readLanguage } from "@/lib/i18n";
import { getCurrentUser } from "./dal";
import { field } from "./form-state";
import { CURRENCY_COOKIE, LANGUAGE_COOKIE, preferenceCookie } from "./preference-cookie";

/** Switches the currency money is shown in. Amounts stay stored in US dollars. */
export async function setCurrency(formData: FormData) {
  // A preference, but only the signed-in app has money to show.
  await getCurrentUser();
  const currency = readCurrency(field(formData, "currency"));
  (await cookies()).set(preferenceCookie(CURRENCY_COOKIE, currency));
  refresh();
}

/**
 * Switches the language Stocktake is read in. Open to anyone: the landing and login pages
 * offer it too. It doesn't re-render: proxy.ts picks the signed-out pages' prerendered
 * Bangla twins by this cookie as a request arrives, so the switch fetches the page again.
 */
export async function setLanguage(formData: FormData) {
  const language = readLanguage(field(formData, "language"));
  (await cookies()).set(preferenceCookie(LANGUAGE_COOKIE, language));
}
