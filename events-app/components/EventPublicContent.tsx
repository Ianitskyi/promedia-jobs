import type { Locale } from "@/lib/i18n/locale";
import { formatEventDateTime } from "@/lib/format-event-time";
import { eventName, eventDescription, eventVenueName } from "@/lib/i18n/event-content";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export interface EventPublicContentEvent {
  event_language: "uk" | "en" | "bilingual";
  name_uk: string | null;
  name_en: string | null;
  description_uk: string | null;
  description_en: string | null;
  start_date: string;
  start_time: string;
  timezone: string;
  venue_name_uk: string | null;
  venue_name_en: string | null;
  address: string | null;
  logo_url: string | null;\n  cover_image_url: string | null;\n  event_format: "offline" | "online" | "hybrid";\n  city: string | null;\n  region: string | null;\n  country_code: string | null;
}

interface EventPublicContentProps {
  event: EventPublicContentEvent;
  organizationName: string;
  organizationLogoUrl: string | null;
  locale: Locale;
  showLanguageSwitcher: boolean;
  onLocaleChange: (locale: Locale) => Promise<void>;
  /** The registration form / status notice for this event — kept as a
   * slot rather than built into this component so it can vary (real
   * registration on the public page, a non-submitting preview form on
   * the dashboard preview route) without a second copy of the header/
   * title/description/date/venue presentation below. */
  children: React.ReactNode;
}

/**
 * The event-facing presentation shared by the public event page
 * (`app/e/[slug]/page.tsx`) and the organizer-only draft preview
 * (`app/dashboard/events/[eventId]/preview/page.tsx`) — branding row,
 * title, description, date/time, venue/address. Kept as the single
 * place this layout is defined so the preview can never drift from
 * what an attendee actually sees.
 */
export function EventPublicContent({
  event,
  organizationName,
  organizationLogoUrl,
  locale,
  showLanguageSwitcher,
  onLocaleChange,
  children,
}: EventPublicContentProps) {
  const dateLabel = formatEventDateTime(event.start_date, event.start_time, event.timezone);
  const name = eventName(event, locale);
  const description = eventDescription(event, locale);
  const venueName = eventVenueName(event, locale);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo name={organizationName} logoUrl={event.logo_url ?? organizationLogoUrl} />
          <span className="text-sm text-muted">{organizationName}</span>
        </div>
        {showLanguageSwitcher && <LanguageSwitcher locale={locale} setLocale={onLocaleChange} />}
      </div>

      {event.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- remote organizer-provided image
        <img src={event.cover_image_url} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl border border-[var(--border)] object-cover" />
      )}
      <h1 className="mt-6 heading-display text-3xl">{name}</h1>
      {description && <p className="mt-3 text-sm text-muted">{description}</p>}
      <p className="mt-4 text-sm">
        {dateLabel} ({event.timezone})
      </p>
      <p className="text-sm text-muted">
        {event.event_format === "online" ? "Online" : [event.city, event.region, event.country_code].filter(Boolean).join(", ")}
      </p>
      {venueName && <p className="text-sm text-muted">{venueName}</p>}
      {event.address && <p className="text-sm text-muted">{event.address}</p>}

      <div className="mt-10">{children}</div>
    </>
  );
}
