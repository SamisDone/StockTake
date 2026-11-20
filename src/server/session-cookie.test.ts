import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS } from "@/domain/session-policy";
import { SESSION_COOKIE, isPublicPath, looksLikeSessionToken, safeNextPath, sessionCookie } from "./session-cookie";

describe("sessionCookie", () => {
  it("is httpOnly, lax, site-wide, and lives as long as a session", () => {
    expect(sessionCookie("token")).toMatchObject({
      name: SESSION_COOKIE,
      value: "token",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  });
});

describe("looksLikeSessionToken", () => {
  it("accepts the 43-character base64url form that createSession issues", () => {
    expect(looksLikeSessionToken("a".repeat(43))).toBe(true);
    expect(looksLikeSessionToken("Ab0-_".repeat(8) + "xyz")).toBe(true);
  });

  it("rejects anything else before it reaches the database", () => {
    expect(looksLikeSessionToken(undefined)).toBe(false);
    expect(looksLikeSessionToken("")).toBe(false);
    expect(looksLikeSessionToken("a".repeat(42))).toBe(false);
    expect(looksLikeSessionToken("a".repeat(44))).toBe(false);
    expect(looksLikeSessionToken("a".repeat(42) + "=")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("lets signed-out visitors see the marketing page and the login page", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats everything else as part of the app", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/products/12")).toBe(false);
    expect(isPublicPath("/login/extra")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site path with its query and hash", () => {
    expect(safeNextPath("/products?q=bolt#row-4")).toBe("/products?q=bolt#row-4");
    expect(safeNextPath("/orders/12")).toBe("/orders/12");
  });

  it("falls back to the dashboard for anything that could leave the site", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "products",
      // The URL parser drops tabs and newlines, turning this into "//evil.example".
      "/\t/evil.example",
      "/\n/evil.example",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeNextPath(next), String(next)).toBe("/dashboard");
    }
  });

  it("never sends someone back to the login page", () => {
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath("/login?next=/login")).toBe("/dashboard");
  });

  it("refuses absurdly long targets", () => {
    expect(safeNextPath("/" + "a".repeat(600))).toBe("/dashboard");
  });
});
