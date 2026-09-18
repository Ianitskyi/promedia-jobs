"use server";

import { redirect } from "next/navigation";
import { requirePermission, getFirstMembership } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { zonedTimeToUtc } from "@/lib/timezone";
import { eventFormSchema } from "@/lib/validation/event";
import type { EventFormState } from "@/components/EventForm";

export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const membership = await getFirstMembership();
  if (!membership) redirect("/dashboard/onboarding");
  await requirePermission(membership.organizationId, "manageEvents");

  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const values = parsed.data;

  const supabase = await createClient();
  let slug = slugify(values.name) || "event";

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
        organization_id: membership.organizationId,
        name: values.name,
        slug,
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
      .select("id")
      .single();

    if (!error && data) {
      redirect(`/dashboard/events/${data.id}`);
    }

    if (error?.code === "23505") {
      slug = withRandomSuffix(slugify(values.name) || "event");
      continue;
    }

    return { error: "Could not create the event. Please try again." };
  }

  return { error: "Could not create the event. Please try again." };
}
