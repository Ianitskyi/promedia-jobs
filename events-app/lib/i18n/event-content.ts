import type { Locale } from "./locale";

/**
 * Resolves one of an event's localized fields for a given display
 * locale, falling back to whichever language the event actually has
 * content in. A `uk`-only event still needs a readable name even when
 * viewed by an organizer whose *dashboard* locale is English — the
 * event's own language and the viewer's platform locale are
 * independent (§4 of the i18n brief), so this always degrades
 * gracefully rather than showing blank text.
 */
function resolveField(primary: string | null, secondary: string | null): string | null {
  return primary ?? secondary ?? null;
}

export function eventName(
  event: { name_uk: string | null; name_en: string | null },
  locale: Locale,
): string {
  const value =
    locale === "uk"
      ? resolveField(event.name_uk, event.name_en)
      : resolveField(event.name_en, event.name_uk);
  return value ?? "";
}

export function eventDescription(
  event: { description_uk: string | null; description_en: string | null },
  locale: Locale,
): string | null {
  return locale === "uk"
    ? resolveField(event.description_uk, event.description_en)
    : resolveField(event.description_en, event.description_uk);
}

export function eventVenueName(
  event: { venue_name_uk: string | null; venue_name_en: string | null },
  locale: Locale,
): string | null {
  return locale === "uk"
    ? resolveField(event.venue_name_uk, event.venue_name_en)
    : resolveField(event.venue_name_en, event.venue_name_uk);
}
