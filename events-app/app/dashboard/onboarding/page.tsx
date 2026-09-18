import { isSelfServiceOrgCreationEnabled } from "@/lib/config";
import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  const enabled = isSelfServiceOrgCreationEnabled();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl italic">Create your organization</h1>

      {enabled ? (
        <>
          <p className="mt-2 text-sm text-muted">
            You&apos;ll be its first owner. You can invite more people and add
            events afterward.
          </p>
          <OnboardingForm />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Organization creation is currently invite-only. Contact your
          platform administrator to get set up.
        </p>
      )}
    </main>
  );
}
