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
 * All attendees for an event, with check-in status joined in. Uses the
 * session-bound (RLS-enforcing) client — callers must already be a
 * member of the event's organization, which every documented
 * "view attendees" permission (OWNER/ADMIN/CHECKIN_STAFF) allows.
 *
 * Three small queries instead of one embedded select: this project's
 * hand-written database.types.ts doesn't declare foreign-key
 * Relationships (no live Supabase project to generate them from), so
 * PostgREST embedded-resource typing isn't available. Fine at MVP
 * attendee-list sizes; revisit with generated types once a project is
 * linked.
 */
export async function listEventAttendees(eventId: string): Promise<AttendeeRow[]> {
  const supabase = await createClient();

  const { data: attendees } = await supabase
    .from("attendees")
    .select("id, first_name, last_name, email, company, position, registered_at")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (!attendees || attendees.length === 0) return [];

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, attendee_id")
    .eq("event_id", eventId);

  const { data: checkins } = await supabase
    .from("checkins")
    .select("ticket_id, checked_in_at")
    .eq("event_id", eventId);

  const ticketByAttendee = new Map((tickets ?? []).map((t) => [t.attendee_id, t.id]));
  const checkinByTicket = new Map((checkins ?? []).map((c) => [c.ticket_id, c.checked_in_at]));

  return attendees.map((a) => {
    const ticketId = ticketByAttendee.get(a.id) ?? null;
    return {
      id: a.id,
      ticketId,
      firstName: a.first_name,
      lastName: a.last_name,
      email: a.email,
      company: a.company,
      position: a.position,
      registeredAt: a.registered_at,
      checkedInAt: ticketId ? (checkinByTicket.get(ticketId) ?? null) : null,
    };
  });
}
