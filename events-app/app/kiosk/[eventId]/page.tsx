import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authz";
import { getKioskLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { KioskScanner } from "@/components/KioskScanner";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, workspace_id, logo_url")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  await requirePermission(event.workspace_id, "checkIn");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, logo_url")
    .eq("id", event.workspace_id)
    .single();

  if (!workspace) notFound();

  const locale = await getKioskLocale();
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <KioskScanner
        eventId={event.id}
        organizationName={workspace.name}
        logoUrl={event.logo_url ?? workspace.logo_url}
      />
    </I18nProvider>
  );
}
