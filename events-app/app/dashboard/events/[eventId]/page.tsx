import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership, can } from "@/lib/authz";
import { listEventAttendees } from "@/lib/server/attendees";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { AttendeeTable } from "@/components/AttendeeTable";

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
  const canExport = membership ? can(membership.role, "exportAttendees") : false;

  const attendees = await listEventAttendees(event.id);
  const registered = attendees.length;
  const checkedIn = attendees.filter((a) => a.checkedInAt).length;
  const notCheckedIn = registered - checkedIn;
  const attendanceRate = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;

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
          {canExport && (
            <a href={`/api/events/${event.id}/export`}>
              <Button variant="secondary">Export CSV</Button>
            </a>
          )}
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Registered" value={registered} />
        <Stat label="Checked in" value={checkedIn} />
        <Stat label="Not checked in" value={notCheckedIn} />
        <Stat label="Attendance rate" value={`${attendanceRate}%`} />
      </dl>

      <div className="mt-10">
        <AttendeeTable attendees={attendees} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--border)] px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl italic">{value}</dd>
    </div>
  );
}
