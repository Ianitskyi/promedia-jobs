"use server";

import { redirect } from "next/navigation";
import { requirePermission, getFirstMembership } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createEventFormSchema } from "@/lib/validation/event";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { EventFormState } from "@/components/EventForm";

export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const membership = await getFirstMembership();
  if (!membership) redirect("/dashboard/onboarding");
  await requirePermission(membership.workspaceId, "manageEvents");

  const dict = getDictionary(await getPlatformLocale());
  const parsed = createEventFormSchema(dict).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.genericError };
  }
  const values = parsed.data;

  const supabase = await createClient();
  const slugSource = values.name_uk || values.name_en || "event";
  let slug = slugify(slugSource) || "event";

  const registrationDeadline = values.registration_deadline
    ? zonedTimeToUtc(
        values.registration_deadline.slice(0, 10),
        values.registration_deadline.slice(11, 16),
        values.timezone,
      ).toISOString()
    : null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("events")
      .insert({
        workspace_id: membership.workspaceId,
        event_language: values.event_language,
        name_uk: values.name_uk ?? null,
        name_en: values.name_en ?? null,
        slug,
        description_uk: values.description_uk ?? null,
        description_en: values.description_en ?? null,
        start_date: values.start_date,
        start_time: values.start_time,
        end_date: values.end_date,
        end_time: values.end_time,
        timezone: values.timezone,
        event_format: values.event_format,
        cover_image_url: values.cover_image_url ?? null,
        country_code: values.country_code ?? null,
        region: values.region ?? null,
        city: values.city ?? null,
        venue_name_uk: values.venue_name_uk ?? null,
        venue_name_en: values.venue_name_en ?? null,
        address: values.address ?? null,
        capacity: values.capacity ?? null,
        registration_deadline: registrationDeadline,
        logo_url: values.logo_url ?? null,
        primary_color: values.primary_color || null,
        status: values.status,
      })
      .select("id")
      .single();

    if (!error && data) {
      redirect(`/dashboard/events/${data.id}`);
    }

    if (error?.code === "23505") {
      slug = withRandomSuffix(slugify(slugSource) || "event");
      continue;
    }

    return { error: dict.events.createError };
  }

  return { error: dict.events.createError };
}
