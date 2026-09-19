"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createEventFormSchema } from "@/lib/validation/event";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { EventFormState } from "@/components/EventForm";

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const dict = getDictionary(await getPlatformLocale());
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("workspace_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: dict.events.notFoundError };
  }

  await requirePermission(event.workspace_id, "manageEvents");

  const parsed = createEventFormSchema(dict).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.genericError };
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
      event_language: values.event_language,
      name_uk: values.name_uk ?? null,
      name_en: values.name_en ?? null,
      description_uk: values.description_uk ?? null,
      description_en: values.description_en ?? null,
      start_date: values.start_date,
      start_time: values.start_time,
      end_date: values.end_date,
      end_time: values.end_time,
      timezone: values.timezone,
      venue_name_uk: values.venue_name_uk ?? null,
      venue_name_en: values.venue_name_en ?? null,
      address: values.address ?? null,
      capacity: values.capacity ?? null,
      registration_deadline: registrationDeadline,
      logo_url: values.logo_url ?? null,
      primary_color: values.primary_color || null,
      status: values.status,
    })
    .eq("id", eventId);

  if (error) {
    return { error: dict.events.saveError };
  }

  redirect(`/dashboard/events/${eventId}`);
}
