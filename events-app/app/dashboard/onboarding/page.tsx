import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * There is no self-service organization creation. Provisioning is
 * controlled at the database level (see ARCHITECTURE.md §7a) and, until
 * a Platform Admin flow exists to drive it, happens by hand — this page
 * is simply what a signed-in user with no organization membership sees.
 */
export default async function OnboardingPage() {
  const dict = getDictionary(await getPlatformLocale());

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl italic">{dict.dashboard.onboardingInviteOnlyTitle}</h1>
      <p className="mt-2 text-sm text-muted">{dict.dashboard.onboardingInviteOnlyMessage}</p>
    </main>
  );
}
