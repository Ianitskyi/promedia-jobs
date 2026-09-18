import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership, can } from "@/lib/authz";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";

const statusTone = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  CLOSED: "warning",
  ARCHIVED: "danger",
} as const;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const membership = await getMembership(event.organization_id);
  const canManage = membership ? can(membership.role, "manageEvents") : false;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl italic">{event.name}</h1>
            <StatusBadge tone={statusTone[event.status]}>{event.status}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted">
            {event.start_date} · {event.venue_name ?? "No venue set"} ·{" "}
            <Link href={`/e/${event.slug}`} className="underline underline-offset-2" target="_blank">
              /e/{event.slug}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/events/${event.id}/scanner`}>
            <Button variant="secondary">Scanner</Button>
          </Link>
          {canManage && (
            <Link href={`/dashboard/events/${event.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
