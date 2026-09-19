import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, Workspace } from "@/lib/database.types";

export type PublicEventState =
  | "not_found"
  | "registration_closed"
  | "deadline_passed"
  | "capacity_reached"
  | "open";

export interface PublicEvent {
  event: Event;
  organization: Pick<Workspace, "name" | "logo_url" | "primary_color">;
  state: PublicEventState;
}

/**
 * Loads an event for the public registration page. Uses the admin
 * client because this is an unauthenticated route — DRAFT events are
 * treated identically to "doesn't exist" so their existence isn't
 * leaked before an organizer publishes them.
 */
export async function getPublicEventBySlug(slug: string): Promise<PublicEvent | null> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, workspaces(name, logo_url, primary_color)")
    .eq("slug", slug)
    .single();

  if (!event || event.status === "DRAFT") {
    return null;
  }

  const organization = (event as unknown as { workspaces: Pick<Workspace, "name" | "logo_url" | "primary_color"> }).workspaces;

  let state: PublicEventState = "open";
  if (event.status !== "PUBLISHED") {
    state = "registration_closed";
  } else if (
    event.registration_deadline &&
    new Date(event.registration_deadline).getTime() < Date.now()
  ) {
    state = "deadline_passed";
  } else if (event.capacity !== null) {
    const { count } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if ((count ?? 0) >= event.capacity) {
      state = "capacity_reached";
    }
  }

  return { event: event as Event, organization, state };
}
