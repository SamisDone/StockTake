import { NextResponse, type NextRequest } from "next/server";
import { LANGUAGE_COOKIE, preferenceCookie } from "./server/preference-cookie";
import {
  BANGLA_TWINS,
  LOGIN_PATH,
  SESSION_COOKIE,
  isPublicPath,
  looksLikeSessionToken,
  sessionCookie,
} from "./server/session-cookie";

/**
 * An optimistic check only: it sees whether a session cookie is present, never whether
 * the session is valid. That is decided in src/server/dal.ts, next to the data, on
 * every page and every Server Action.
 *
 * It also picks the language of the signed-out pages, which are prerendered in both:
 * a Bangla reader's request for / or /login is served the /bn twin, and opening a /bn
 * address directly makes Bangla that reader's language.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;
  const signedIn = looksLikeSessionToken(token);

  if (!signedIn && !isPublicPath(pathname)) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const twin = BANGLA_TWINS[pathname];
  const response =
    twin && request.cookies.get(LANGUAGE_COOKIE)?.value === "bn"
      ? NextResponse.rewrite(new URL(twin + search, request.url))
      : NextResponse.next();
  if (request.method !== "GET") return response;

  if (pathname === "/bn" || pathname.startsWith("/bn/")) response.cookies.set(preferenceCookie(LANGUAGE_COOKIE, "bn"));
  // Server Components can't set cookies, so the session's lifetime slides forward here
  // instead. POSTs are left alone: sign-in and sign-out set or clear it themselves.
  if (signedIn) response.cookies.set(sessionCookie(token));
  return response;
}

export const config = {
  // Every page, but not build assets or files with an extension (icons, images).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
