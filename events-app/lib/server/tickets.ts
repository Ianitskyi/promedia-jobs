import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTokenFormat } from "@/lib/tokens";
import type { Event, Workspace, Ticket, UiLanguage } from "@/lib/database.types";

export interface TicketDetails {
  ticket: Ticket;
  /**
   * A display-only projection of the registered person for this event
   * (their persistent `Person` name/language, plus what they gave as
   * their company *for this registration*) — not a database table.
   */
  attendee: {
    first_name: string;
    last_name: string;
    company: string | null;
    preferred_language: UiLanguage;
  };
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
  workspace: Pick<Workspace, "name" | "logo_url">;
}

/**
 * Looks up a ticket by its public token. This is the one place a
 * completely anonymous caller (the ticket page, before any scan) can
 * read attendee data — scoped to exactly the fields the ticket view
 * needs, nothing else about the person or other registrants.
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

  const { data: registration } = await supabase
    .from("registrations")
    .select("company_at_registration, person_id")
    .eq("id", ticket.registration_id)
    .single();
  if (!registration) return null;

  const { data: person } = await supabase
    .from("people")
    .select("first_name, last_name, preferred_language")
    .eq("id", registration.person_id)
    .single();
  if (!person || !person.preferred_language) return null;

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, event_language, name_uk, name_en, slug, start_date, start_time, timezone, venue_name_uk, venue_name_en, address, logo_url, workspace_id",
    )
    .eq("id", ticket.event_id)
    .single();

  if (!event) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, logo_url")
    .eq("id", event.workspace_id)
    .single();

  if (!workspace) return null;

  return {
    ticket,
    attendee: {
      first_name: person.first_name,
      last_name: person.last_name,
      company: registration.company_at_registration,
      preferred_language: person.preferred_language,
    },
    event,
    workspace,
  };
}
