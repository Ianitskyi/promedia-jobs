import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { applyDefaultLocaleCookie } from "./middleware";
import { PLATFORM_LOCALE_COOKIE } from "./locale";

function makeRequest(opts: { acceptLanguage?: string; existingCookie?: string }) {
  const headers = new Headers();
  if (opts.acceptLanguage) headers.set("accept-language", opts.acceptLanguage);
  if (opts.existingCookie) headers.set("cookie", `${PLATFORM_LOCALE_COOKIE}=${opts.existingCookie}`);
  return new NextRequest("https://example.com/", { headers });
}

describe("applyDefaultLocaleCookie", () => {
  it("sets the cookie from Accept-Language on a first visit (no cookie yet)", () => {
    const request = makeRequest({ acceptLanguage: "en-US,en;q=0.9" });
    const response = NextResponse.next();
    applyDefaultLocaleCookie(request, response);
    expect(response.cookies.get(PLATFORM_LOCALE_COOKIE)?.value).toBe("en");
  });

  it("defaults to Ukrainian on a first visit with no usable Accept-Language", () => {
    const request = makeRequest({});
    const response = NextResponse.next();
    applyDefaultLocaleCookie(request, response);
    expect(response.cookies.get(PLATFORM_LOCALE_COOKIE)?.value).toBe("uk");
  });

  it("never overwrites an existing cookie — explicit selection persists across navigation", () => {
    // Simulates a visitor who already chose English via the switcher,
    // even though their browser's Accept-Language says Ukrainian: the
    // explicit choice must win, forever, not just for one request.
    const request = makeRequest({ acceptLanguage: "uk-UA", existingCookie: "en" });
    const response = NextResponse.next();
    applyDefaultLocaleCookie(request, response);
    expect(response.cookies.get(PLATFORM_LOCALE_COOKIE)).toBeUndefined();
  });
});
