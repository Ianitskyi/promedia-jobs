import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership, can } from "@/lib/authz";
import { checkInByToken, checkInByTicketId } from "@/lib/server/checkin";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

const schema = z
  .object({
    eventId: z.uuid(),
    token: z.string().max(64).optional(),
    ticketId: z.uuid().optional(),
    method: z.enum(["QR", "MANUAL", "KIOSK"]),
  })
  .refine((d) => Boolean(d.token) !== Boolean(d.ticketId), {
    message: "Provide exactly one of token or ticketId.",
  });

/**
 * The single server-side entry point every check-in path (scanner,
 * manual search, kiosk) goes through. Never trusts eventId/token from
 * the client beyond using them to look up rows — tenant/role
 * authorization is re-checked here against the event's real
 * organization on every call.
 */
export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  const { allowed } = checkRateLimit(`checkin:${ip}`, 120, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id, workspace_id")
    .eq("id", parsed.data.eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const membership = await getMembership(event.workspace_id);
  if (!membership || !can(membership.role, "checkIn")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const actor = { userId: membership.userId, method: parsed.data.method };
  const result = parsed.data.token
    ? await checkInByToken(parsed.data.token, event.id, actor)
    : await checkInByTicketId(parsed.data.ticketId!, event.id, actor);

  return NextResponse.json(result);
}
