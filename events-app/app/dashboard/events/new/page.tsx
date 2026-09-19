import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EventForm } from "@/components/EventForm";
import { createEvent } from "./actions";

export default async function NewEventPage() {
  const dict = getDictionary(await getPlatformLocale());

  return (
    <div>
      <h1 className="heading-display text-3xl">{dict.events.createTitle}</h1>
      <div className="mt-8">
        <EventForm action={createEvent} submitLabel={dict.events.submitCreate} />
      </div>
    </div>
  );
}
