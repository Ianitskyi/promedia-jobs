import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCalendarDate } from "@/lib/format-event-time";
import type { EventStatus } from "@/lib/database.types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface EventCardProps {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  venueName: string | null;
  status: EventStatus;
  dict: Dictionary;
}

const statusTone: Record<EventStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  CLOSED: "warning",
  ARCHIVED: "danger",
};

export function EventCard({ id, name, slug, startDate, venueName, status, dict }: EventCardProps) {
  const statusLabel: Record<EventStatus, string> = {
    DRAFT: dict.events.statusDraft,
    PUBLISHED: dict.events.statusPublished,
    CLOSED: dict.events.statusClosed,
    ARCHIVED: dict.events.statusArchived,
  };

  return (
    <Link
      href={`/dashboard/events/${id}`}
      className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-5 transition-colors hover:bg-[var(--surface)]"
    >
      <div>
        <p className="font-serif text-xl italic">{name}</p>
        <p className="mt-1 text-sm text-muted">
          {formatCalendarDate(startDate)}
          {venueName ? ` · ${venueName}` : ""} · /e/{slug}
        </p>
      </div>
      <StatusBadge tone={statusTone[status]}>{statusLabel[status]}</StatusBadge>
    </Link>
  );
}
