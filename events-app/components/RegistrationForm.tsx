"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { useI18n } from "@/lib/i18n/client";
import type { RegisterFormState } from "@/app/e/[slug]/actions";

type RegistrationFormProps =
  | {
      /** Real registration: wired to the actual register() server action for a PUBLISHED event. */
      preview?: false;
      action: (prev: RegisterFormState, formData: FormData) => Promise<RegisterFormState>;
    }
  | {
      /** Organizer draft preview (app/dashboard/events/[eventId]/preview): renders the same
       * form but can never create a real registration — see the notice rendered below and
       * the `handleSubmit` guard, both independent of one another (belt and suspenders). */
      preview: true;
      action?: undefined;
    };

/** Preview mode never calls a server action — this is never invoked. */
async function previewNoopAction(prev: RegisterFormState): Promise<RegisterFormState> {
  return prev;
}

export function RegistrationForm(props: RegistrationFormProps) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState(
    props.preview ? previewNoopAction : props.action,
    { error: null },
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (props.preview) {
      // Belt and suspenders: even though the button below is disabled
      // and the wired action is a no-op, a draft preview must never be
      // able to create a real registration under any circumstance.
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={dict.registration.firstName} htmlFor="first_name" required>
          <Input id="first_name" name="first_name" autoComplete="given-name" required />
        </FormField>
        <FormField label={dict.registration.lastName} htmlFor="last_name" required>
          <Input id="last_name" name="last_name" autoComplete="family-name" required />
        </FormField>
      </div>

      <FormField label={dict.registration.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>

      <FormField label={dict.registration.organization} htmlFor="company">
        <Input id="company" name="company" autoComplete="organization" />
      </FormField>

      <FormField label={dict.registration.position} htmlFor="position">
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
        <span className="text-muted">{dict.registration.consentText}</span>
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

      {props.preview && (
        <p className="text-xs text-muted">{dict.registration.previewNotice}</p>
      )}

      <Button type="submit" disabled={pending || props.preview}>
        {pending ? dict.registration.registering : dict.registration.register}
      </Button>
    </form>
  );
}
