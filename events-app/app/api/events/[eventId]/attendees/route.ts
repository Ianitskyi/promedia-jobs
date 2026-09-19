import { NextResponse } from "next/server";
import { getMembership, can } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { listEventAttendees } from "@/lib/server/attendees";

/** Attendee search for manual check-in ("Can't scan the QR?"). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("workspace_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const membership = await getMembership(event.workspace_id);
  if (!membership || !can(membership.role, "checkIn")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const attendees = await listEventAttendees(eventId);
  const matches = attendees
    .filter(
      (a) =>
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    )
    .slice(0, 20)
    .map((a) => ({
      attendeeId: a.id,
      ticketId: a.ticketId,
      firstName: a.firstName,
      lastName: a.lastName,
      company: a.company,
      checkedInAt: a.checkedInAt,
    }));

  return NextResponse.json({ results: matches });
}
