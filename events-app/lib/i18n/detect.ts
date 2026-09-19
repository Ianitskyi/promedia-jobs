import { DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * First-visit-only convenience: picks a starting platform locale from
 * the browser's Accept-Language header. Only ever consulted when no
 * locale cookie exists yet (see lib/i18n/middleware.ts) — any explicit
 * choice via the language switcher always wins after that, for the
 * lifetime of the cookie.
 *
 * Supported set is just uk/en, so this is deliberately simple: an
 * English preference gets English, everything else gets the platform
 * default (Ukrainian). No inference from anything other than the
 * browser's own stated language preference — never nationality,
 * IP geolocation, or any other personal signal.
 */
export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",")[0]?.trim().toLowerCase();
  if (first?.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}
