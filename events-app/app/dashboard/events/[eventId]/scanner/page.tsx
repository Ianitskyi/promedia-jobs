import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authz";
import { Scanner } from "@/components/Scanner";

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, organization_id")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  await requirePermission(event.organization_id, "checkIn");

  return (
    <div>
      <h1 className="font-serif text-2xl italic">{event.name} — Scanner</h1>
      <p className="mt-1 text-sm text-muted">Point the camera at an attendee&apos;s ticket QR code.</p>
      <div className="mt-6">
        <Scanner eventId={event.id} />
      </div>
    </div>
  );
}
