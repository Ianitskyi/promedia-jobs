"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAuthWeakPasswordError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { createResetPasswordFormSchema } from "@/lib/validation/auth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Status = "verifying" | "invalid" | "ready" | "success";

/** How long to wait for a PASSWORD_RECOVERY session before treating the
 * link as invalid — covers a user opening this page directly with no
 * recovery token at all, not just a genuinely expired/used link. */
const VERIFY_TIMEOUT_MS = 8000;

/**
 * Supabase Auth redirects an expired/invalid/already-used recovery link
 * back to this page with `error`/`error_code` query parameters instead
 * of establishing a session — pulled out as a pure function so this
 * branch is unit-testable without rendering the component.
 */
export function statusFromSearch(search: string): "verifying" | "invalid" {
  const params = new URLSearchParams(search);
  return params.get("error") || params.get("error_code") ? "invalid" : "verifying";
}

/**
 * Maps an updateUser() failure to a localized message without ever
 * surfacing Supabase's raw error text (which can describe internal
 * implementation details). Pulled out as a pure function so the
 * weak-password-vs-generic branch is unit-testable directly.
 */
export function resolveUpdatePasswordError(error: unknown, dict: Dictionary): string {
  return isAuthWeakPasswordError(error) ? dict.auth.resetPasswordRejected : dict.common.genericError;
}

/**
 * Handles the Supabase Auth password-recovery callback for this app's
 * installed @supabase/ssr version (0.12.x), which hard-codes
 * `flowType: "pkce"` on both the browser and server clients. Per
 * @supabase/ssr's own design docs, a recovery link exchange completes
 * client-side and is announced via the `PASSWORD_RECOVERY`
 * onAuthStateChange event — there is no separate server route handler
 * involved. If the link is invalid/expired, Supabase Auth redirects
 * back here with `error`/`error_code` query parameters instead of
 * establishing a session, which this component also checks for.
 */
export function ResetPasswordForm() {
  const { dict } = useI18n();
  const [status, setStatus] = useState<Status>("verifying");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;

    if (statusFromSearch(window.location.search) === "invalid") {
      // window.location isn't available during the server render, so
      // this can only be known after mount — deliberately not computed
      // as initial useState to avoid a client/server render mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setStatus("invalid");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "verifying" ? "invalid" : current));
    }, VERIFY_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = createResetPasswordFormSchema(dict).safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? dict.common.genericError);
      return;
    }

    setPending(true);
    try {
      const { error } = await supabaseRef.current.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        setFormError(resolveUpdatePasswordError(error, dict));
        return;
      }
      await supabaseRef.current.auth.signOut();
      setStatus("success");
    } catch {
      setFormError(dict.common.networkError);
    } finally {
      setPending(false);
    }
  }

  if (status === "verifying") {
    return <p className="mt-6 text-sm text-muted">{dict.auth.verifyingResetLink}</p>;
  }

  if (status === "invalid") {
    return (
      <>
        <p role="alert" className="mt-6 text-sm text-red-700">
          {dict.auth.resetLinkInvalidOrExpired}
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-6 self-start text-sm text-muted underline underline-offset-2 hover:text-foreground"
        >
          {dict.auth.requestNewResetLink}
        </Link>
      </>
    );
  }

  if (status === "success") {
    return (
      <>
        <p role="status" className="mt-6 text-sm text-foreground">
          {dict.auth.resetPasswordSuccessMessage}
        </p>
        <Link href="/login" className="mt-6 self-start">
          <Button type="button">{dict.auth.goToSignIn}</Button>
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
      <FormField label={dict.auth.newPasswordLabel} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </FormField>
      <FormField label={dict.auth.confirmPasswordLabel} htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </FormField>

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? dict.auth.pleaseWait : dict.auth.resetPasswordSubmit}
      </Button>
    </form>
  );
}
