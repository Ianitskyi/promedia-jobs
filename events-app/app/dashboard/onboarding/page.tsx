import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * There is no self-service workspace creation. Provisioning is
 * controlled at the database level (see docs/ARCHITECTURE_V2.md §9) and,
 * until a Platform Admin flow exists to drive it, happens by hand — this
 * page is simply what a signed-in user with no workspace membership sees.
 */
export default async function OnboardingPage() {
  const dict = getDictionary(await getPlatformLocale());

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="heading-display text-3xl">{dict.dashboard.onboardingInviteOnlyTitle}</h1>
      <p className="mt-2 text-sm text-muted">{dict.dashboard.onboardingInviteOnlyMessage}</p>
    </main>
  );
}
