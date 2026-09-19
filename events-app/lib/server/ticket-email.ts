import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/lib/email";
import { buildTicketEmail } from "@/lib/email/templates";
import { renderQrDataUrl } from "@/lib/qr";
import { ticketUrl } from "@/lib/url";
import { formatEventDateTime } from "@/lib/format-event-time";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName, eventVenueName } from "@/lib/i18n/event-content";

/**
 * Sends the ticket confirmation email for a freshly created ticket, in
 * the attendee's own registered language (`attendees.preferred_language`)
 * — never a combined Ukrainian+English email. Best-effort: the caller
 * treats a failure here as non-fatal to registration (the ticket URL
 * always works even if the email never arrives), matching the brief's
 * requirement that the ticket page, not the email, is the source of
 * truth.
 */
export async function sendTicketEmail(token: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("event_id, attendee_id, public_token")
    .eq("public_token", token)
    .single();
  if (!ticket) return;

  const { data: attendee } = await supabase
    .from("attendees")
    .select("first_name, last_name, email, preferred_language")
    .eq("id", ticket.attendee_id)
    .single();
  if (!attendee) return;

  const { data: event } = await supabase
    .from("events")
    .select("name_uk, name_en, start_date, start_time, timezone, venue_name_uk, venue_name_en, organization_id")
    .eq("id", ticket.event_id)
    .single();
  if (!event) return;

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", event.organization_id)
    .single();
  if (!organization) return;

  const locale = attendee.preferred_language;
  const dict = getDictionary(locale);
  const dateLabel = `${formatEventDateTime(event.start_date, event.start_time, event.timezone)} (${event.timezone})`;

  const url = ticketUrl(ticket.public_token);
  const qrDataUrl = await renderQrDataUrl(url);

  const { subject, html, text } = buildTicketEmail(dict, {
    organizationName: organization.name,
    eventName: eventName(event, locale),
    attendeeFirstName: attendee.first_name,
    attendeeLastName: attendee.last_name,
    dateLabel,
    venueName: eventVenueName(event, locale),
    ticketUrl: url,
    qrDataUrl,
  });

  await getEmailProvider().send({ to: attendee.email, subject, html, text });
}
