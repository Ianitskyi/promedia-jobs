import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTokenFormat } from "@/lib/tokens";
import type { Attendee, Event, Organization, Ticket } from "@/lib/database.types";

export interface TicketDetails {
  ticket: Ticket;
  attendee: Pick<Attendee, "first_name" | "last_name" | "company" | "preferred_language">;
  event: Pick<
    Event,
    | "id"
    | "event_language"
    | "name_uk"
    | "name_en"
    | "slug"
    | "start_date"
    | "start_time"
    | "timezone"
    | "venue_name_uk"
    | "venue_name_en"
    | "address"
    | "logo_url"
  >;
  organization: Pick<Organization, "name" | "logo_url">;
}

/**
 * Looks up a ticket by its public token. This is the one place a
 * completely anonymous caller (the ticket page, before any scan) can
 * read attendee data — scoped to exactly the fields the ticket view
 * needs, nothing else about the attendee or other registrants.
 */
export async function getTicketByToken(token: string): Promise<TicketDetails | null> {
  if (!isValidTokenFormat(token)) return null;

  const supabase = createAdminClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!ticket) return null;

  const { data: attendee } = await supabase
    .from("attendees")
    .select("first_name, last_name, company, preferred_language")
    .eq("id", ticket.attendee_id)
    .single();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, event_language, name_uk, name_en, slug, start_date, start_time, timezone, venue_name_uk, venue_name_en, address, logo_url, organization_id",
    )
    .eq("id", ticket.event_id)
    .single();

  if (!attendee || !event) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, logo_url")
    .eq("id", event.organization_id)
    .single();

  if (!organization) return null;

  return { ticket, attendee, event, organization };
}
