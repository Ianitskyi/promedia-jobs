"use server";

import { cookies } from "next/headers";
import {
  PLATFORM_LOCALE_COOKIE,
  PUBLIC_LOCALE_COOKIE,
  KIOSK_LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/i18n/locale";

export async function setPlatformLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(PLATFORM_LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/" });
}

export async function setPublicLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(PUBLIC_LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/" });
}

export async function setKioskLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(KIOSK_LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/" });
}
