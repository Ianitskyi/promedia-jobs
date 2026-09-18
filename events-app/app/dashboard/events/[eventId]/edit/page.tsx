import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div>
      <h1 className="font-serif text-3xl italic">Edit event</h1>
      <div className="mt-8">
        <EventForm
          action={updateEvent.bind(null, eventId)}
          defaultValues={event}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
