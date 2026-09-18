"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "./actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";

const initialState: OnboardingState = { error: null };

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(
    createOrganization,
    initialState,
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl italic">Create your organization</h1>
      <p className="mt-2 text-sm text-muted">
        You&apos;ll be its first owner. You can invite more people and add
        events afterward.
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormField label="Organization name" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            placeholder="ProMedia"
            autoFocus
            required
          />
        </FormField>

        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </main>
  );
}
