"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export interface AuthFormState {
  error: string | null;
  message?: string | null;
}

/**
 * True when a Supabase auth call failed at the transport layer (DNS,
 * TLS, connection refused, a misconfigured Supabase URL) rather than
 * returning a real auth response. supabase-js surfaces these as
 * `AuthRetryableFetchError` with `status: 0` and the raw message
 * "fetch failed" — which must never be shown to the user verbatim.
 */
function isNetworkAuthError(error: {
  name?: string;
  status?: number;
  message?: string;
}): boolean {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    error.status === undefined ||
    error.message === "fetch failed"
  );
}

/**
 * Log an auth failure server-side for diagnosis without ever recording a
 * secret or PII: only the coarse error shape (name/status/code) is
 * emitted — never the email, password, tokens, or the raw message (which
 * can echo back request contents).
 */
function logAuthFailure(
  context: string,
  error: { name?: string; status?: number; code?: string },
): void {
  console.error(
    `[auth] ${context} failed:`,
    JSON.stringify({ name: error.name, status: error.status, code: error.code }),
  );
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const dict = getDictionary(await getPlatformLocale());

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: dict.auth.invalidCredentials };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (isNetworkAuthError(error)) {
      logAuthFailure("signIn", error);
      return { error: dict.auth.serviceUnavailable };
    }
    return { error: dict.auth.invalidCredentials };
  }

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const dict = getDictionary(await getPlatformLocale());

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: dict.auth.invalidSignupInput };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    // Never surface the raw provider message (e.g. the transport-level
    // "fetch failed") to the end user — classify into a friendly,
    // localized message and log the shape server-side for diagnosis.
    if (isNetworkAuthError(error)) {
      logAuthFailure("signUp", error);
      return { error: dict.auth.serviceUnavailable };
    }
    if (error.status === 422 || error.code === "user_already_exists") {
      return { error: dict.auth.emailAlreadyRegistered };
    }
    logAuthFailure("signUp", error);
    return { error: dict.auth.signupFailed };
  }

  if (!data.session) {
    return {
      error: null,
      message: dict.auth.checkEmailToConfirm,
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
