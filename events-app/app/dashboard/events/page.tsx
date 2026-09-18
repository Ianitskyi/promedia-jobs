import Link from "next/link";
import { redirect } from "next/navigation";
import { getFirstMembership } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/Button";

export default async function EventsPage() {
  const membership = await getFirstMembership();
  if (!membership) redirect("/dashboard/onboarding");

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, start_date, venue_name, status")
    .eq("organization_id", membership.organizationId)
    .order("start_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl italic">Events</h1>
        <Link href="/dashboard/events/new">
          <Button>+ Create event</Button>
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No events yet. Create your first event to get a public registration
          page and QR check-in.
        </p>
      ) : (
        <div className="mt-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              name={event.name}
              slug={event.slug}
              startDate={event.start_date}
              venueName={event.venue_name}
              status={event.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
