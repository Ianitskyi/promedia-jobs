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
 * the registered person's own language (`people.preferred_language`) —
 * never a combined Ukrainian+English email. Best-effort: the caller
 * treats a failure here as non-fatal to registration (the ticket URL
 * always works even if the email never arrives), matching the brief's
 * requirement that the ticket page, not the email, is the source of
 * truth.
 */
export async function sendTicketEmail(token: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("event_id, registration_id, public_token")
    .eq("public_token", token)
    .single();
  if (!ticket) return;

  const { data: registration } = await supabase
    .from("registrations")
    .select("person_id")
    .eq("id", ticket.registration_id)
    .single();
  if (!registration) return;

  const { data: person } = await supabase
    .from("people")
    .select("first_name, last_name, email, preferred_language")
    .eq("id", registration.person_id)
    .single();
  if (!person || !person.preferred_language) return;

  const { data: event } = await supabase
    .from("events")
    .select("name_uk, name_en, start_date, start_time, timezone, venue_name_uk, venue_name_en, workspace_id")
    .eq("id", ticket.event_id)
    .single();
  if (!event) return;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", event.workspace_id)
    .single();
  if (!workspace) return;

  const locale = person.preferred_language;
  const dict = getDictionary(locale);
  const dateLabel = `${formatEventDateTime(event.start_date, event.start_time, event.timezone)} (${event.timezone})`;

  const url = ticketUrl(ticket.public_token);
  const qrDataUrl = await renderQrDataUrl(url);

  const { subject, html, text } = buildTicketEmail(dict, {
    organizationName: workspace.name,
    eventName: eventName(event, locale),
    attendeeFirstName: person.first_name,
    attendeeLastName: person.last_name,
    dateLabel,
    venueName: eventVenueName(event, locale),
    ticketUrl: url,
    qrDataUrl,
  });

  await getEmailProvider().send({ to: person.email, subject, html, text });
}
