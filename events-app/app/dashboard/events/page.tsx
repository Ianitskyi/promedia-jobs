import Link from "next/link";
import { redirect } from "next/navigation";
import { getFirstMembership } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName, eventVenueName } from "@/lib/i18n/event-content";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/Button";

export default async function EventsPage() {
  const membership = await getFirstMembership();
  if (!membership) redirect("/dashboard/onboarding");

  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name_uk, name_en, slug, start_date, venue_name_uk, venue_name_en, status")
    .eq("organization_id", membership.organizationId)
    .order("start_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl italic">{dict.events.title}</h1>
        <Link href="/dashboard/events/new">
          <Button>{dict.events.createButton}</Button>
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{dict.events.noEventsYet}</p>
      ) : (
        <div className="mt-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              name={eventName(event, locale)}
              slug={event.slug}
              startDate={event.start_date}
              venueName={eventVenueName(event, locale)}
              status={event.status}
              dict={dict}
            />
          ))}
        </div>
      )}
    </div>
  );
}
