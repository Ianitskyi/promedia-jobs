"use server";

import { headers } from "next/headers";
import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createForgotPasswordFormSchema } from "@/lib/validation/auth";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/url";

export interface ForgotPasswordFormState {
  status: "idle" | "sent" | "error";
  error: string | null;
}

/**
 * Always resolves to the neutral "sent" state on any outcome that could
 * otherwise reveal whether an email address has an account — including
 * a genuine Supabase-side error — so this action must never be used to
 * answer "does this email exist?" from response shape alone. The only
 * exceptions are our own client-side-equivalent input validation (a
 * malformed email never reaches Supabase at all) and IP-based rate
 * limiting (keyed on the requester, not the email, so it can't be used
 * to probe individual addresses) and a genuine network/transport
 * failure (symmetric regardless of the email's validity).
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const dict = getDictionary(await getPlatformLocale());

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const { allowed } = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60_000);
  if (!allowed) {
    return { status: "error", error: dict.auth.forgotPasswordTooManyAttempts };
  }

  const parsed = createForgotPasswordFormSchema(dict).safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? dict.common.genericError };
  }

  try {
    // The normal user-facing (anon key) Supabase Auth client — never
    // the service-role client — same as sign-in/sign-up above.
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/auth/reset-password`,
    });

    if (error) {
      if (isAuthRetryableFetchError(error)) {
        return { status: "error", error: dict.common.networkError };
      }
      if (isAuthApiError(error) && error.status === 429) {
        return { status: "error", error: dict.auth.forgotPasswordTooManyAttempts };
      }
      // Any other Supabase-side error (including "user not found" style
      // responses, if ever returned) still resolves to the neutral
      // message below — never surfaced as a distinguishable error.
    }
  } catch {
    return { status: "error", error: dict.common.networkError };
  }

  return { status: "sent", error: null };
}
