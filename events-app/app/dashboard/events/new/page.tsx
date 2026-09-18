import { EventForm } from "@/components/EventForm";
import { createEvent } from "./actions";

export default function NewEventPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl italic">Create event</h1>
      <div className="mt-8">
        <EventForm action={createEvent} submitLabel="Create event" />
      </div>
    </div>
  );
}
