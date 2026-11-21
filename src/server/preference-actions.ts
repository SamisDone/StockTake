"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { readCurrency } from "@/domain/exchange";
import { getCurrentUser } from "./dal";
import { field } from "./form-state";
import { CURRENCY_COOKIE, preferenceCookie } from "./preferences";

/** Switches the currency money is shown in. Amounts stay stored in US dollars. */
export async function setCurrency(formData: FormData) {
  // A preference, but only the signed-in app has money to show.
  await getCurrentUser();
  const currency = readCurrency(field(formData, "currency"));
  (await cookies()).set(preferenceCookie(CURRENCY_COOKIE, currency));
  refresh();
}
