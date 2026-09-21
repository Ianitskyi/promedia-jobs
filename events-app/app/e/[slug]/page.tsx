import { notFound } from "next/navigation";
import { getPublicEventBySlug } from "@/lib/server/public-events";
import { resolvePublicLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPublicLocale } from "@/lib/i18n/actions";
import { EventPublicContent } from "@/components/EventPublicContent";
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

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-12" style={accentStyle}>
        <EventPublicContent
          event={event}
          organizationName={organization.name}
          organizationLogoUrl={organization.logo_url}
          locale={locale}
          showLanguageSwitcher={event.event_language === "bilingual"}
          onLocaleChange={setPublicLocale}
        >
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
        </EventPublicContent>
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
