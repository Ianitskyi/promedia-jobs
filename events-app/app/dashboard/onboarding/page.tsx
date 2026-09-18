import { isSelfServiceOrgCreationEnabled } from "@/lib/config";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { OnboardingForm } from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const enabled = isSelfServiceOrgCreationEnabled();
  const dict = getDictionary(await getPlatformLocale());

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl italic">{dict.dashboard.onboardingTitle}</h1>

      {enabled ? (
        <>
          <p className="mt-2 text-sm text-muted">{dict.dashboard.onboardingSubtitle}</p>
          <OnboardingForm />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {dict.dashboard.onboardingInviteOnlyTitle} {dict.dashboard.onboardingInviteOnlyMessage}
        </p>
      )}
    </main>
  );
}
