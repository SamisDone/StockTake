import { NextResponse, type NextRequest } from "next/server";
import {
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
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (!looksLikeSessionToken(token)) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Server Components can't set cookies, so the cookie's lifetime slides forward here
  // instead. POSTs are left alone: sign-in and sign-out set or clear it themselves.
  const response = NextResponse.next();
  if (request.method === "GET") response.cookies.set(sessionCookie(token));
  return response;
}

export const config = {
  // Every page, but not build assets or files with an extension (icons, images).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
