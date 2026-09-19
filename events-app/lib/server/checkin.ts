import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTokenFormat } from "@/lib/tokens";
import type { CheckinMethod, Ticket } from "@/lib/database.types";

export type CheckinResultState =
  | "INVALID_TICKET"
  | "WRONG_EVENT"
  | "TICKET_REVOKED"
  | "ALREADY_CHECKED_IN"
  | "CHECKED_IN";

export interface CheckinResult {
  state: CheckinResultState;
  attendee?: { firstName: string; lastName: string; company: string | null };
  checkedInAt?: string;
}

export interface CheckinActor {
  userId: string | null;
  method: CheckinMethod;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function finalizeCheckin(
  supabase: AdminClient,
  ticket: Ticket,
  eventId: string,
  actor: CheckinActor,
): Promise<CheckinResult> {
  if (ticket.event_id !== eventId) {
    return { state: "WRONG_EVENT" };
  }
  if (ticket.revoked_at) {
    return { state: "TICKET_REVOKED" };
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select("company_at_registration, person_id")
    .eq("id", ticket.registration_id)
    .single();
  if (!registration) {
    return { state: "INVALID_TICKET" };
  }

  const { data: person } = await supabase
    .from("people")
    .select("first_name, last_name")
    .eq("id", registration.person_id)
    .single();
  if (!person) {
    return { state: "INVALID_TICKET" };
  }

  const { data, error } = await supabase.rpc("perform_checkin", {
    p_ticket_id: ticket.id,
    p_event_id: eventId,
    p_method: actor.method,
    p_checked_in_by: actor.userId,
  });

  const row = data?.[0];
  if (error || !row) {
    return { state: "INVALID_TICKET" };
  }

  return {
    state: row.was_created ? "CHECKED_IN" : "ALREADY_CHECKED_IN",
    attendee: {
      firstName: person.first_name,
      lastName: person.last_name,
      company: registration.company_at_registration,
    },
    checkedInAt: row.checked_in_at,
  };
}

/** Scanner / kiosk path: the QR encodes only the public token. */
export async function checkInByToken(
  token: string,
  eventId: string,
  actor: CheckinActor,
): Promise<CheckinResult> {
  if (!isValidTokenFormat(token)) {
    return { state: "INVALID_TICKET" };
  }

  const supabase = createAdminClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!ticket) {
    return { state: "INVALID_TICKET" };
  }

  return finalizeCheckin(supabase, ticket, eventId, actor);
}

/** Manual check-in path: staff picked the attendee from a search result. */
export async function checkInByTicketId(
  ticketId: string,
  eventId: string,
  actor: CheckinActor,
): Promise<CheckinResult> {
  const supabase = createAdminClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return { state: "INVALID_TICKET" };
  }

  return finalizeCheckin(supabase, ticket, eventId, actor);
}
