"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotPasswordFormState } from "@/app/auth/forgot-password/actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { useI18n } from "@/lib/i18n/client";

const initialState: ForgotPasswordFormState = { status: "idle", error: null };

export function ForgotPasswordForm() {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.status === "sent") {
    return (
      <>
        <p role="status" className="mt-6 text-sm text-foreground">
          {dict.auth.forgotPasswordNeutralMessage}
        </p>
        <Link
          href="/login"
          className="mt-6 self-start text-sm text-muted underline underline-offset-2 hover:text-foreground"
        >
          {dict.auth.backToSignIn}
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-muted">{dict.auth.forgotPasswordSubtitle}</p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormField label={dict.auth.emailLabel} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </FormField>

        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? dict.auth.pleaseWait : dict.auth.forgotPasswordSubmit}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 text-left text-sm text-muted underline underline-offset-2 hover:text-foreground"
      >
        {dict.auth.backToSignIn}
      </Link>
    </>
  );
}
