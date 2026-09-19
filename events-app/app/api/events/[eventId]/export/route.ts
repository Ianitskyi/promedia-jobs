import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership, can } from "@/lib/authz";
import { listEventAttendees } from "@/lib/server/attendees";
import { toCsv } from "@/lib/csv";

const HEADERS = [
  "First name",
  "Last name",
  "Email",
  "Organization",
  "Position",
  "Registration time",
  "Check-in status",
  "Check-in time",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("workspace_id, slug")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const membership = await getMembership(event.workspace_id);
  if (!membership || !can(membership.role, "exportAttendees")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const attendees = await listEventAttendees(eventId);
  const rows = attendees.map((a) => [
    a.firstName,
    a.lastName,
    a.email,
    a.company ?? "",
    a.position ?? "",
    a.registeredAt,
    a.checkedInAt ? "Checked in" : "Not checked in",
    a.checkedInAt ?? "",
  ]);

  const csv = toCsv(HEADERS, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-attendees.csv"`,
    },
  });
}
