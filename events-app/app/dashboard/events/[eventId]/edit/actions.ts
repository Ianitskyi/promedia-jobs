"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/timezone";
import { eventFormSchema } from "@/lib/validation/event";
import type { EventFormState } from "@/components/EventForm";

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("organization_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Event not found." };
  }

  await requirePermission(event.organization_id, "manageEvents");

  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const values = parsed.data;

  const registrationDeadline = values.registration_deadline
    ? zonedTimeToUtc(
        values.registration_deadline.slice(0, 10),
        values.registration_deadline.slice(11, 16),
        values.timezone,
      ).toISOString()
    : null;

  const { error } = await supabase
    .from("events")
    .update({
      name: values.name,
      description: values.description ?? null,
      start_date: values.start_date,
      start_time: values.start_time,
      end_date: values.end_date,
      end_time: values.end_time,
      timezone: values.timezone,
      venue_name: values.venue_name ?? null,
      address: values.address ?? null,
      capacity: values.capacity ?? null,
      registration_deadline: registrationDeadline,
      logo_url: values.logo_url ?? null,
      primary_color: values.primary_color || null,
      status: values.status,
    })
    .eq("id", eventId);

  if (error) {
    return { error: "Could not save changes. Please try again." };
  }

  redirect(`/dashboard/events/${eventId}`);
}
