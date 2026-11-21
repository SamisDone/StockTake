import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";
import { SESSION_COOKIE } from "./server/session-cookie";

const TOKEN = "t".repeat(43);

function request(
  path: string,
  { cookie, language, method = "GET" }: { cookie?: string; language?: string; method?: string } = {},
) {
  const headers = new Headers();
  const cookies = [
    cookie !== undefined ? `${SESSION_COOKIE}=${cookie}` : null,
    language !== undefined ? `language=${language}` : null,
  ].filter(Boolean);
  if (cookies.length > 0) headers.set("cookie", cookies.join("; "));
  return new NextRequest(new URL(path, "https://stocktake.test"), { method, headers });
}

describe("proxy matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("runs on pages", () => {
    for (const url of ["/", "/login", "/dashboard", "/products/12", "/orders?status=draft"]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it("skips build assets and static files", () => {
    for (const url of ["/_next/static/chunks/app.js", "/_next/image?url=x", "/favicon.ico", "/og.png"]) {
      expect(matches(url), url).toBe(false);
    }
  });
});

describe("proxy", () => {
  it("sends a signed-out visitor to the login page, remembering where they were going", () => {
    const response = proxy(request("/products?q=bolt"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/products?q=bolt");
  });

  it("treats a malformed cookie as signed out", () => {
    const response = proxy(request("/dashboard", { cookie: "nonsense" }));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("lets signed-out visitors see the public pages", () => {
    for (const path of ["/", "/login"]) {
      const response = proxy(request(path));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.headers.get("set-cookie"), path).toBeNull();
    }
  });

  it("does not bounce a cookie holder away from the login page", () => {
    // The cookie may belong to a session that has expired in the database; only the
    // data-access layer knows, so redirecting here could loop.
    expect(proxy(request("/login", { cookie: TOKEN })).headers.get("location")).toBeNull();
  });

  it("slides the cookie's lifetime forward on page loads", () => {
    const response = proxy(request("/dashboard", { cookie: TOKEN }));
    expect(response.headers.get("location")).toBeNull();
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain(`${SESSION_COOKIE}=${TOKEN}`);
    expect(setCookie).toMatch(/Max-Age=2592000/i);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("leaves the cookie alone on POSTs, where Server Actions set or clear it themselves", () => {
    const response = proxy(request("/dashboard", { cookie: TOKEN, method: "POST" }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("proxy languages", () => {
  const rewrittenTo = (response: Response) => {
    const target = response.headers.get("x-middleware-rewrite");
    return target ? new URL(target).pathname + new URL(target).search : null;
  };

  it("serves a Bangla reader the prerendered Bangla twin of the signed-out pages", () => {
    expect(rewrittenTo(proxy(request("/", { language: "bn" })))).toBe("/bn");
    expect(rewrittenTo(proxy(request("/login?next=/orders", { language: "bn" })))).toBe("/bn/login?next=/orders");
  });

  it("leaves English readers, and the app's own pages, as they are", () => {
    expect(rewrittenTo(proxy(request("/")))).toBeNull();
    expect(rewrittenTo(proxy(request("/", { language: "en" })))).toBeNull();
    expect(rewrittenTo(proxy(request("/dashboard", { cookie: TOKEN, language: "bn" })))).toBeNull();
  });

  it("makes Bangla the reader's language when a /bn page is opened directly", () => {
    for (const path of ["/bn", "/bn/login"]) {
      const response = proxy(request(path));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.headers.get("set-cookie"), path).toMatch(/language=bn/);
    }
  });
});
