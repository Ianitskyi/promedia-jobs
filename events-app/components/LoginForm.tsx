"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/login/actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { useI18n } from "@/lib/i18n/client";

const initialState: AuthFormState = { error: null };

export function LoginForm() {
  const { dict } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <>
      <p className="mt-2 text-sm text-muted">
        {mode === "signin" ? dict.auth.signInSubtitle : dict.auth.signUpSubtitle}
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormField label={dict.auth.emailLabel} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </FormField>
        <FormField
          label={dict.auth.passwordLabel}
          htmlFor="password"
          required
          hint={mode === "signup" ? dict.auth.passwordHint : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </FormField>

        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-emerald-700">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? dict.auth.pleaseWait : mode === "signin" ? dict.auth.signIn : dict.auth.signUp}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 text-left text-sm text-muted underline underline-offset-2 hover:text-foreground"
      >
        {mode === "signin" ? dict.auth.toggleToSignUp : dict.auth.toggleToSignIn}
      </button>
    </>
  );
}
