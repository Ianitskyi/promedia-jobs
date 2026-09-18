import { getTicketByToken } from "@/lib/server/tickets";
import { renderQrSvg } from "@/lib/qr";
import { ticketUrl } from "@/lib/url";
import { formatEventDateTime } from "@/lib/format-event-time";
import { Ticket } from "@/components/Ticket";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const details = await getTicketByToken(token);

  if (!details) {
    return (
      <StateMessage
        title="Ticket not found"
        body="This ticket link is invalid. Double-check the URL, or contact the event organizer."
      />
    );
  }

  if (details.ticket.revoked_at) {
    return (
      <StateMessage
        title="Ticket revoked"
        body="This ticket is no longer valid. Contact the event organizer if you believe this is a mistake."
      />
    );
  }

  const { attendee, event, organization, ticket } = details;
  const qrSvg = await renderQrSvg(ticketUrl(ticket.public_token));

  const dateLabel = formatEventDateTime(event.start_date, event.start_time, event.timezone);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <Ticket
        organizationName={organization.name}
        organizationLogoUrl={organization.logo_url}
        eventLogoUrl={event.logo_url}
        eventName={event.name}
        attendeeName={`${attendee.first_name} ${attendee.last_name}`}
        attendeeCompany={attendee.company}
        dateLabel={`${dateLabel} (${event.timezone})`}
        venueName={event.venue_name}
        address={event.address}
        qrSvg={qrSvg}
      />
    </main>
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
