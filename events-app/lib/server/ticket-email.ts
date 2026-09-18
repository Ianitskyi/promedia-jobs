import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/lib/email";
import { buildTicketEmail } from "@/lib/email/templates";
import { renderQrDataUrl } from "@/lib/qr";
import { ticketUrl } from "@/lib/url";
import { formatEventDateTime } from "@/lib/format-event-time";

/**
 * Sends the ticket confirmation email for a freshly created ticket.
 * Best-effort: the caller treats a failure here as non-fatal to
 * registration (the ticket URL always works even if the email never
 * arrives), matching the brief's requirement that the ticket page,
 * not the email, is the source of truth.
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
    .select("first_name, last_name, email")
    .eq("id", ticket.attendee_id)
    .single();
  if (!attendee) return;

  const { data: event } = await supabase
    .from("events")
    .select("name, start_date, start_time, timezone, venue_name, organization_id")
    .eq("id", ticket.event_id)
    .single();
  if (!event) return;

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", event.organization_id)
    .single();
  if (!organization) return;

  const dateLabel = `${formatEventDateTime(event.start_date, event.start_time, event.timezone)} (${event.timezone})`;

  const url = ticketUrl(ticket.public_token);
  const qrDataUrl = await renderQrDataUrl(url);

  const { subject, html, text } = buildTicketEmail({
    organizationName: organization.name,
    eventName: event.name,
    attendeeFirstName: attendee.first_name,
    attendeeLastName: attendee.last_name,
    dateLabel,
    venueName: event.venue_name,
    ticketUrl: url,
    qrDataUrl,
  });

  await getEmailProvider().send({ to: attendee.email, subject, html, text });
}
