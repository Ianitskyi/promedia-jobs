"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { CONSENT_TEXT } from "@/lib/consent";
import type { RegisterFormState } from "@/app/e/[slug]/actions";

interface RegistrationFormProps {
  action: (prev: RegisterFormState, formData: FormData) => Promise<RegisterFormState>;
}

export function RegistrationForm({ action }: RegistrationFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="First name" htmlFor="first_name" required>
          <Input id="first_name" name="first_name" autoComplete="given-name" required />
        </FormField>
        <FormField label="Last name" htmlFor="last_name" required>
          <Input id="last_name" name="last_name" autoComplete="family-name" required />
        </FormField>
      </div>

      <FormField label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>

      <FormField label="Organization" htmlFor="company">
        <Input id="company" name="company" autoComplete="organization" />
      </FormField>

      <FormField label="Position" htmlFor="position">
        <Input id="position" name="position" autoComplete="organization-title" />
      </FormField>

      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label htmlFor="consent" className="flex items-start gap-2.5 text-sm">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-muted">{CONSENT_TEXT}</span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.info && (
        <p role="status" className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-muted">
          {state.info}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Registering…" : "Register"}
      </Button>
    </form>
  );
}
