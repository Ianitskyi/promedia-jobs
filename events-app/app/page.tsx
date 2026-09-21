import Link from "next/link";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { I18nProvider } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/Button";
import { listPublishedEvents } from "@/lib/server/public-events";
import { eventName } from "@/lib/i18n/event-content";
import { formatEventDateTime } from "@/lib/format-event-time";

/**
 * Public landing page for ProMedia Events. Both CTAs route into the
 * existing single auth flow at /login (see app/login/page.tsx +
 * components/LoginForm.tsx) — "Create account" opens it in its signup
 * state via `?mode=signup` rather than duplicating a second auth form.
 */
export default async function HomePage() {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);\n  const publishedEvents = await listPublishedEvents();

  const capabilities = [
    dict.landing.capabilityRegisterParticipants,
    dict.landing.capabilityIssueQrTickets,
    dict.landing.capabilitySelfCheckIn,
    dict.landing.capabilityVerifyAtEntrance,
    dict.landing.capabilityDownloadList,
  ];

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no responsive sizing needed */}
          <img
            src="/brand/promedia-wordmark.svg"
            alt={dict.landing.title}
            className="h-9 w-auto"
          />
          <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
        </div>

        <h1 className="mt-10 heading-display text-3xl">{dict.landing.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-foreground">{dict.landing.description}</p>
        <p className="mt-3 max-w-xl text-sm text-muted">{dict.landing.supportingText}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login?mode=signup">
            <Button>{dict.landing.primaryCta}</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">{dict.landing.secondaryCta}</Button>
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="heading-display text-lg">{dict.landing.capabilitiesHeading}</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-foreground">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="text-muted">
                  ✓
                </span>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </section>
        {publishedEvents.length > 0 && (
          <section className="mt-16">
            <h2 className="heading-display text-xl">{dict.landing.upcomingEventsHeading}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {publishedEvents.map((event) => (
                <Link key={event.id} href={`/e/${event.slug}`} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                  {event.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote organizer-provided image
                    <img src={event.cover_image_url} alt="" className="aspect-[16/9] w-full object-cover" />
                  )}
                  <div className="p-5">
                    <p className="heading-display text-lg">{eventName(event, locale)}</p>
                    <p className="mt-2 text-sm text-muted">{formatEventDateTime(event.start_date, event.start_time, event.timezone)}</p>
                    <p className="mt-1 text-sm text-muted">
                      {event.event_format === "online" ? dict.landing.onlineLabel : [event.city, event.region].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-3 text-xs text-muted">{event.organization_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </I18nProvider>
  );
}
