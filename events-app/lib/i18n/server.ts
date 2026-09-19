import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  PLATFORM_LOCALE_COOKIE,
  PUBLIC_LOCALE_COOKIE,
  KIOSK_LOCALE_COOKIE,
  isLocale,
  type Locale,
  type EventLanguage,
} from "@/lib/i18n/locale";

/** The organizer dashboard/auth interface language for the current request. */
export async function getPlatformLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(PLATFORM_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The language a public event page/ticket should render in.
 * `uk`/`en` events are single-language by definition — the event
 * setting wins outright, no attendee choice involved. Only a
 * `bilingual` event consults the attendee's remembered choice (falling
 * back to the platform default if they haven't chosen yet).
 */
export async function resolvePublicLocale(eventLanguage: EventLanguage): Promise<Locale> {
  if (eventLanguage === "uk" || eventLanguage === "en") {
    return eventLanguage;
  }
  const store = await cookies();
  const value = store.get(PUBLIC_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Same idea as `resolvePublicLocale`, but for the ticket page
 * specifically: when a bilingual event's attendee hasn't (yet) touched
 * the switcher, default to *their own* registered language rather than
 * the generic platform default — they already told us which language
 * they wanted when they registered.
 */
export async function resolveTicketLocale(
  eventLanguage: EventLanguage,
  attendeePreferredLanguage: Locale,
): Promise<Locale> {
  if (eventLanguage === "uk" || eventLanguage === "en") {
    return eventLanguage;
  }
  const store = await cookies();
  const value = store.get(PUBLIC_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : attendeePreferredLanguage;
}

/**
 * The kiosk station's own language, independent of both the logged-in
 * organizer's dashboard locale and any attendee's choice — a kiosk is
 * a physical device at the door, set once by whoever started it.
 * Falls back to the platform locale the first time a kiosk is opened.
 */
export async function getKioskLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(KIOSK_LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;
  return getPlatformLocale();
}
