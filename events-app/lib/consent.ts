import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Registration consent text, versioned. Each registration stores a
 * snapshot of this text, its version, and the language it was shown in
 * (registration_consents table), so changing the copy here — in either
 * language — never affects the audit trail of past registrations, only
 * new ones. Bump the version when either language's wording changes,
 * even if only one language actually changed: the version identifies
 * "this revision of the consent language" as a whole, not per-locale.
 */
export const CONSENT_VERSION = "2026-01";

export function getConsentText(locale: Locale): string {
  return getDictionary(locale).registration.consentText;
}
