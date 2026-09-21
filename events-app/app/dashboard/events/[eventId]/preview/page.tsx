import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authz";
import { resolvePublicLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPublicLocale } from "@/lib/i18n/actions";
import { EventPublicContent } from "@/components/EventPublicContent";
import { RegistrationForm } from "@/components/RegistrationForm";

/**
 * Organizer-only preview of how a DRAFT (or any other status) event's
 * public page looks, without exposing it publicly and without ever
 * being able to create a real registration.
 *
 * Authorization: the event is loaded through the session-bound,
 * RLS-enforcing client (lib/supabase/server.ts) — a user with no
 * membership in the event's workspace gets zero rows back from
 * `events_select`'s RLS policy, so `!event` already 404s them before
 * any application-level check runs. `requirePermission(...,
 * "manageEvents")` on top of that is the same check
 * app/dashboard/events/[eventId]/edit uses, for a friendlier
 * redirect-based denial and to keep "who can preview" identical to
 * "who can edit" rather than inventing a new permission tier.
 *
 * This route never mutates the event, never changes its status, and
 * is not reachable by an unauthenticated visitor (the root middleware
 * already redirects signed-out requests away from all of /dashboard).
 */
export default async function EventPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();

  if (!event) notFound();

  await requirePermission(event.workspace_id, "manageEvents");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, logo_url, primary_color")
    .eq("id", event.workspace_id)
    .single();
  if (!workspace) notFound();

  const locale = await resolvePublicLocale(event.event_language);
  const dict = getDictionary(locale);
  const accentStyle = workspace.primary_color
    ? ({ "--accent": workspace.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col" style={accentStyle}>
        <EventPublicContent
          event={event}
          organizationName={workspace.name}
          organizationLogoUrl={workspace.logo_url}
          locale={locale}
          showLanguageSwitcher={event.event_language === "bilingual"}
          onLocaleChange={setPublicLocale}
        >
          <RegistrationForm preview />
        </EventPublicContent>
      </div>
    </I18nProvider>
  );
}
