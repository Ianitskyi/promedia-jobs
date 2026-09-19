import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AttendeeRow {
  id: string;
  ticketId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  position: string | null;
  registeredAt: string;
  checkedInAt: string | null;
}

/**
 * All registered people for an event, with check-in status joined in.
 * Uses the session-bound (RLS-enforcing) client — callers must already
 * be a member of the event's workspace, which every documented "view
 * attendees" permission (OWNER/ADMIN/CHECKIN_STAFF) allows.
 *
 * `id` here is the registration id (not the person id) — this is what
 * the rest of the dashboard (manual check-in search, CSV export) treats
 * as "the attendee" for this specific event, consistent with the old
 * per-event attendee row it replaces. See ARCHITECTURE_V2.md §5 for why
 * contact fields now live on a persistent `Person` and only the
 * event-specific ones live on `Registration`.
 *
 * Several small queries instead of one embedded select: this project's
 * hand-written database.types.ts doesn't declare foreign-key
 * Relationships (no live Supabase project to generate them from), so
 * PostgREST embedded-resource typing isn't available. Fine at MVP
 * attendee-list sizes; revisit with generated types once a project is
 * linked.
 */
export async function listEventAttendees(eventId: string): Promise<AttendeeRow[]> {
  const supabase = await createClient();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, person_id, company_at_registration, position_at_registration, registered_at")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (!registrations || registrations.length === 0) return [];

  const personIds = [...new Set(registrations.map((r) => r.person_id))];
  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name, email")
    .in("id", personIds);

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, registration_id")
    .eq("event_id", eventId);

  const { data: checkins } = await supabase
    .from("checkins")
    .select("ticket_id, checked_in_at")
    .eq("event_id", eventId);

  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const ticketByRegistration = new Map((tickets ?? []).map((t) => [t.registration_id, t.id]));
  const checkinByTicket = new Map((checkins ?? []).map((c) => [c.ticket_id, c.checked_in_at]));

  return registrations.flatMap((r) => {
    const person = personById.get(r.person_id);
    if (!person) return [];

    const ticketId = ticketByRegistration.get(r.id) ?? null;
    return [
      {
        id: r.id,
        ticketId,
        firstName: person.first_name,
        lastName: person.last_name,
        email: person.email,
        company: r.company_at_registration,
        position: r.position_at_registration,
        registeredAt: r.registered_at,
        checkedInAt: ticketId ? (checkinByTicket.get(ticketId) ?? null) : null,
      },
    ];
  });
}
