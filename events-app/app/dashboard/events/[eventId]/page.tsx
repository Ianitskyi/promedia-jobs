import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership, can } from "@/lib/authz";
import { listEventAttendees } from "@/lib/server/attendees";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName, eventVenueName } from "@/lib/i18n/event-content";
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
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const membership = await getMembership(event.workspace_id);
  const canManage = membership ? can(membership.role, "manageEvents") : false;
  const canExport = membership ? can(membership.role, "exportAttendees") : false;

  const attendees = await listEventAttendees(event.id);
  const registered = attendees.length;
  const checkedIn = attendees.filter((a) => a.checkedInAt).length;
  const notCheckedIn = registered - checkedIn;
  const attendanceRate = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;

  const statusLabel: Record<string, string> = {
    DRAFT: dict.events.statusDraft,
    PUBLISHED: dict.events.statusPublished,
    CLOSED: dict.events.statusClosed,
    ARCHIVED: dict.events.statusArchived,
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="heading-display text-3xl">{eventName(event, locale)}</h1>
            <StatusBadge tone={statusTone[event.status]}>{statusLabel[event.status]}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted">
            {event.start_date} · {eventVenueName(event, locale) ?? dict.events.noVenueSet}
          </p>
        </div>
        <div className="flex gap-2">
          {event.status === "DRAFT" ? (
            <Link href={`/dashboard/events/${event.id}/preview`}>
              <Button variant="secondary">{dict.events.previewButton}</Button>
            </Link>
          ) : (
            <Link href={`/e/${event.slug}`} target="_blank">
              <Button variant="secondary">{dict.events.openEventPageButton}</Button>
            </Link>
          )}
          <Link href={`/dashboard/events/${event.id}/scanner`}>
            <Button variant="secondary">{dict.events.scannerButton}</Button>
          </Link>
          <Link href={`/kiosk/${event.id}`} target="_blank">
            <Button variant="secondary">{dict.events.kioskButton}</Button>
          </Link>
          {canManage && (
            <Link href={`/dashboard/events/${event.id}/edit`}>
              <Button variant="secondary">{dict.events.editButton}</Button>
            </Link>
          )}
          {canExport && (
            <a href={`/api/events/${event.id}/export`}>
              <Button variant="secondary">{dict.events.exportCsvButton}</Button>
            </a>
          )}
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={dict.events.statRegistered} value={registered} />
        <Stat label={dict.events.statCheckedIn} value={checkedIn} />
        <Stat label={dict.events.statNotCheckedIn} value={notCheckedIn} />
        <Stat label={dict.events.statAttendanceRate} value={`${attendanceRate}%`} />
      </dl>

      <div className="mt-10">
        <AttendeeTable attendees={attendees} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 heading-display text-2xl">{value}</dd>
    </div>
  );
}
