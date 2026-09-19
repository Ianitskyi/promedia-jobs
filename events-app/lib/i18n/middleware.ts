import type { NextRequest, NextResponse } from "next/server";
import { PLATFORM_LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./locale";
import { detectLocaleFromAcceptLanguage } from "./detect";

/**
 * Sets the platform locale cookie from the browser's Accept-Language
 * header, but only if it isn't set yet — i.e. only on a visitor's
 * first request. Once the language switcher (or this default) has set
 * it, this never overwrites it again, so an explicit choice always
 * sticks.
 */
export function applyDefaultLocaleCookie(request: NextRequest, response: NextResponse): void {
  if (request.cookies.get(PLATFORM_LOCALE_COOKIE)) return;
  const locale = detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  response.cookies.set(PLATFORM_LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
  });
}
