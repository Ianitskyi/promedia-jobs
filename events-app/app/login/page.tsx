"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";

const initialState: AuthFormState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl italic">ProMedia Events</h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signin"
          ? "Sign in to your organizer dashboard."
          : "Create an account to get started."}
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          required
          hint={mode === "signup" ? "At least 8 characters." : undefined}
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
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 text-left text-sm text-muted underline underline-offset-2 hover:text-foreground"
      >
        {mode === "signin"
          ? "New organization? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
