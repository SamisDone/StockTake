// Shared by proxy.ts and the data-access layer, so it must not import the database.
import type { Route } from "next";
import { SESSION_TTL_MS } from "@/domain/session-policy";

export const SESSION_COOKIE = "stocktake_session";

/**
 * The session cookie. Its lifetime slides forward on every page load (see proxy.ts),
 * while the session row in D1 decides whether the token is still valid.
 */
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    // Browsers treat http://localhost as secure, so `pnpm preview` works with this on.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** createSession issues 32 random bytes as unpadded base64url: always 43 characters. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Cheap shape check, so a junk cookie never costs a hash and a database read. */
export function looksLikeSessionToken(value: string | undefined): value is string {
  return value !== undefined && TOKEN_SHAPE.test(value);
}

const PUBLIC_PATHS = new Set<string>(["/", "/login"]);

/** Pages a signed-out visitor may see. Everything else is the app and needs a session. */
export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

// The pages these name are built with the UI; until then typedRoutes can't check them.
export const LOGIN_PATH = "/login" as Route;
export const HOME_PATH = "/dashboard" as Route;

/**
 * Where to go after signing in. Only a path on this site is accepted, and the login page
 * itself is not, so a crafted `?next=` can't send anyone elsewhere or into a loop.
 */
export function safeNextPath(next: unknown): Route {
  if (typeof next !== "string" || next.length > 512 || !next.startsWith("/")) return HOME_PATH;

  // Resolve against a placeholder origin: anything that changes the origin
  // ("//host", "/\host", or tabs and newlines the parser drops) is rejected.
  const base = "http://stocktake.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== base || url.pathname === LOGIN_PATH) return HOME_PATH;
  // A same-site path that may not exist; an unknown one lands on the 404 page.
  return (url.pathname + url.search + url.hash) as Route;
}
