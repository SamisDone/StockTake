/**
 * Preference cookies: the currency and language a person reads in. A plain module, so
 * proxy.ts can use it as well as Server Components and Server Actions.
 */

export const CURRENCY_COOKIE = "currency";
export const LANGUAGE_COOKIE = "language";

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
