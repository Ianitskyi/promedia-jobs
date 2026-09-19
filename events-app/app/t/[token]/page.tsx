import { getTicketByToken } from "@/lib/server/tickets";
import { renderQrSvg } from "@/lib/qr";
import { ticketUrl } from "@/lib/url";
import { formatEventDateTime } from "@/lib/format-event-time";
import { resolveTicketLocale, resolvePublicLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName, eventVenueName } from "@/lib/i18n/event-content";
import { I18nProvider } from "@/lib/i18n/client";
import { setPublicLocale } from "@/lib/i18n/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Ticket } from "@/components/Ticket";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const details = await getTicketByToken(token);

  if (!details) {
    const locale = await resolvePublicLocale("bilingual");
    const dict = getDictionary(locale);
    return <StateMessage title={dict.ticket.notFoundTitle} body={dict.ticket.notFoundBody} />;
  }

  const { attendee, event, organization, ticket } = details;
  const locale = await resolveTicketLocale(event.event_language, attendee.preferred_language);
  const dict = getDictionary(locale);

  if (ticket.revoked_at) {
    return <StateMessage title={dict.ticket.revokedTitle} body={dict.ticket.revokedBody} />;
  }

  const qrSvg = await renderQrSvg(ticketUrl(ticket.public_token));
  const dateLabel = formatEventDateTime(event.start_date, event.start_time, event.timezone);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        {event.event_language === "bilingual" && (
          <div className="mx-auto mb-6">
            <LanguageSwitcher locale={locale} setLocale={setPublicLocale} />
          </div>
        )}
        <Ticket
          organizationName={organization.name}
          organizationLogoUrl={organization.logo_url}
          eventLogoUrl={event.logo_url}
          eventName={eventName(event, locale)}
          attendeeName={`${attendee.first_name} ${attendee.last_name}`}
          attendeeCompany={attendee.company}
          dateLabel={`${dateLabel} (${event.timezone})`}
          venueName={eventVenueName(event, locale)}
          address={event.address}
          qrSvg={qrSvg}
        />
      </main>
    </I18nProvider>
  );
}

function StateMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-2xl italic">{title}</h1>
      <p className="mt-3 text-sm text-muted">{body}</p>
    </main>
  );
}
