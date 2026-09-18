"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "@/app/dashboard/onboarding/actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { useI18n } from "@/lib/i18n/client";

const initialState: OnboardingState = { error: null };

export function OnboardingForm() {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
      <FormField label={dict.dashboard.onboardingNameLabel} htmlFor="name" required>
        <Input id="name" name="name" placeholder="ProMedia" autoFocus required />
      </FormField>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? dict.dashboard.onboardingCreating : dict.dashboard.onboardingSubmit}
      </Button>
    </form>
  );
}
