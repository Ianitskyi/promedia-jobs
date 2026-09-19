/**
 * The two MVP interface languages. Adding a third later means adding
 * one value here, one dictionary file, and nothing else architectural
 * — every call site goes through Locale, never a hardcoded "uk"/"en"
 * outside this module and the dictionaries themselves.
 */
export const LOCALES = ["uk", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uk";
export const FALLBACK_LOCALE: Locale = "en";

/** Platform (organizer dashboard/auth) interface language. */
export const PLATFORM_LOCALE_COOKIE = "pm_locale";
/** Attendee's chosen language for bilingual public events. */
export const PUBLIC_LOCALE_COOKIE = "pm_public_locale";
/** Device-level language for a kiosk station, independent of the organizer's own dashboard locale. */
export const KIOSK_LOCALE_COOKIE = "pm_kiosk_locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
export const LOCALE_COOKIE_MAX_AGE = ONE_YEAR_SECONDS;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "uk" || value === "en";
}

/**
 * Event-level publishing language. "bilingual" is only ever a
 * per-event setting (§4 of the brief) — never a person's own language
 * preference, which is always exactly `Locale`.
 */
export const EVENT_LANGUAGES = ["uk", "en", "bilingual"] as const;
export type EventLanguage = (typeof EVENT_LANGUAGES)[number];
