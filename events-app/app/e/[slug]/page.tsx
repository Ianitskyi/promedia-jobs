import { notFound } from "next/navigation";
import { getPublicEventBySlug } from "@/lib/server/public-events";
import { formatEventDateTime } from "@/lib/format-event-time";
import { resolvePublicLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName, eventDescription, eventVenueName } from "@/lib/i18n/event-content";
import { I18nProvider } from "@/lib/i18n/client";
import { setPublicLocale } from "@/lib/i18n/actions";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RegistrationForm } from "@/components/RegistrationForm";
import { register } from "./actions";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicEventBySlug(slug);

  if (!result) notFound();

  const { event, organization, state } = result;
  const locale = await resolvePublicLocale(event.event_language);
  const dict = getDictionary(locale);
  const accentStyle = organization.primary_color
    ? ({ "--accent": organization.primary_color } as React.CSSProperties)
    : undefined;

  const dateLabel = formatEventDateTime(event.start_date, event.start_time, event.timezone);
  const name = eventName(event, locale);
  const description = eventDescription(event, locale);
  const venueName = eventVenueName(event, locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-12" style={accentStyle}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo name={organization.name} logoUrl={event.logo_url ?? organization.logo_url} />
            <span className="text-sm text-muted">{organization.name}</span>
          </div>
          {event.event_language === "bilingual" && (
            <LanguageSwitcher locale={locale} setLocale={setPublicLocale} />
          )}
        </div>

        <h1 className="mt-6 heading-display text-3xl">{name}</h1>
        {description && <p className="mt-3 text-sm text-muted">{description}</p>}
        <p className="mt-4 text-sm">
          {dateLabel} ({event.timezone})
        </p>
        {venueName && <p className="text-sm text-muted">{venueName}</p>}
        {event.address && <p className="text-sm text-muted">{event.address}</p>}

        <div className="mt-10">
          {state === "open" && <RegistrationForm action={register.bind(null, event.id, locale)} />}
          {state === "registration_closed" && (
            <StateNotice
              title={dict.registration.stateRegistrationClosedTitle}
              body={dict.registration.stateRegistrationClosedBody}
            />
          )}
          {state === "deadline_passed" && (
            <StateNotice
              title={dict.registration.stateDeadlinePassedTitle}
              body={dict.registration.stateDeadlinePassedBody}
            />
          )}
          {state === "capacity_reached" && (
            <StateNotice
              title={dict.registration.stateCapacityReachedTitle}
              body={dict.registration.stateCapacityReachedBody}
            />
          )}
        </div>
      </main>
    </I18nProvider>
  );
}

function StateNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
