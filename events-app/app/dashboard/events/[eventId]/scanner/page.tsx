import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authz";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventName } from "@/lib/i18n/event-content";
import { Scanner } from "@/components/Scanner";

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name_uk, name_en, workspace_id")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  await requirePermission(event.workspace_id, "checkIn");

  return (
    <div>
      <h1 className="heading-display text-2xl">
        {eventName(event, locale)} — {dict.scanner.titleSuffix}
      </h1>
      <p className="mt-1 text-sm text-muted">{dict.scanner.instructions}</p>
      <div className="mt-6">
        <Scanner eventId={event.id} />
      </div>
    </div>
  );
}
