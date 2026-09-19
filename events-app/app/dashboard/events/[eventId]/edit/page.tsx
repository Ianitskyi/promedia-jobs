import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authz";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EventForm } from "@/components/EventForm";
import { updateEvent } from "./actions";

export default async function EditEventPage({
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

  await requirePermission(event.organization_id, "manageEvents");
  const dict = getDictionary(await getPlatformLocale());

  return (
    <div>
      <h1 className="font-serif text-3xl italic">{dict.events.editTitle}</h1>
      <div className="mt-8">
        <EventForm
          action={updateEvent.bind(null, eventId)}
          defaultValues={event}
          submitLabel={dict.events.submitEdit}
        />
      </div>
    </div>
  );
}
