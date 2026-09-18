"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerAttendee } from "@/lib/server/registration";
import { sendTicketEmail } from "@/lib/server/ticket-email";
import { createRegistrationFormSchema } from "@/lib/validation/registration";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";

export interface RegisterFormState {
  error: string | null;
  /** Neutral (non-error-styled) message — currently only ALREADY_REGISTERED. */
  info?: string | null;
}

export async function register(
  eventId: string,
  locale: Locale,
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const dict = getDictionary(locale);

  const ERROR_MESSAGES: Record<string, string> = {
    EVENT_NOT_FOUND: dict.registration.errorEventNotFound,
    EVENT_NOT_PUBLISHED: dict.registration.errorEventNotPublished,
    REGISTRATION_CLOSED: dict.registration.errorRegistrationClosed,
    CAPACITY_REACHED: dict.registration.errorCapacityReached,
    INVALID_LANGUAGE: dict.common.genericError,
    UNKNOWN: dict.common.genericError,
  };

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const { allowed } = checkRateLimit(`register:${ip}`, 10, 10 * 60_000);
  if (!allowed) {
    return { error: dict.registration.tooManyAttempts };
  }

  const parsed = createRegistrationFormSchema(dict).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.registration.checkFormAndTryAgain };
  }

  if (parsed.data.website) {
    // Honeypot tripped — pretend nothing happened rather than
    // revealing the anti-spam mechanism.
    return { error: dict.registration.somethingWentWrong };
  }

  const result = await registerAttendee({
    eventId,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    email: parsed.data.email,
    company: parsed.data.company || undefined,
    position: parsed.data.position || undefined,
    language: locale,
  });

  if (!result.ok) {
    if (result.error === "ALREADY_REGISTERED") {
      return { error: null, info: dict.registration.alreadyRegistered };
    }
    return { error: ERROR_MESSAGES[result.error] };
  }

  await sendTicketEmail(result.publicToken).catch((err) => {
    console.error("[registration] confirmation email failed", err);
  });

  redirect(`/t/${result.publicToken}`);
}
