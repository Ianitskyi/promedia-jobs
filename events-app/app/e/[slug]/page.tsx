import { notFound } from "next/navigation";
import { getPublicEventBySlug } from "@/lib/server/public-events";
import { Logo } from "@/components/Logo";
import { RegistrationForm } from "@/components/RegistrationForm";
import { register } from "./actions";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicEventBySlug(slug);

  if (!result) notFound();

  const { event, organization, state } = result;
  const accentStyle = organization.primary_color
    ? ({ "--accent": organization.primary_color } as React.CSSProperties)
    : undefined;

  const dateLabel = new Date(`${event.start_date}T${event.start_time}`).toLocaleString(
    undefined,
    { dateStyle: "long", timeStyle: "short" },
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-12" style={accentStyle}>
      <div className="flex items-center gap-3">
        <Logo name={organization.name} logoUrl={event.logo_url ?? organization.logo_url} />
        <span className="text-sm text-muted">{organization.name}</span>
      </div>

      <h1 className="mt-6 font-serif text-3xl italic">{event.name}</h1>
      {event.description && <p className="mt-3 text-sm text-muted">{event.description}</p>}
      <p className="mt-4 text-sm">
        {dateLabel} ({event.timezone})
      </p>
      {event.venue_name && <p className="text-sm text-muted">{event.venue_name}</p>}
      {event.address && <p className="text-sm text-muted">{event.address}</p>}

      <div className="mt-10">
        {state === "open" && <RegistrationForm action={register.bind(null, event.id)} />}
        {state === "registration_closed" && (
          <StateNotice title="Registration closed" body="This event is no longer accepting registrations." />
        )}
        {state === "deadline_passed" && (
          <StateNotice
            title="Registration deadline passed"
            body="The registration deadline for this event has passed."
          />
        )}
        {state === "capacity_reached" && (
          <StateNotice
            title="Registration full"
            body="This event has reached its registration capacity."
          />
        )}
      </div>
    </main>
  );
}

function StateNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
