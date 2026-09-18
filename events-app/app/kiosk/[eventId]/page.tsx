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
    .select("id, organization_id, logo_url")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  await requirePermission(event.organization_id, "checkIn");

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, logo_url")
    .eq("id", event.organization_id)
    .single();

  if (!organization) notFound();

  const locale = await getKioskLocale();
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <KioskScanner
        eventId={event.id}
        organizationName={organization.name}
        logoUrl={event.logo_url ?? organization.logo_url}
      />
    </I18nProvider>
  );
}
