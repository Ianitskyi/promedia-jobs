"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerAttendee } from "@/lib/server/registration";
import { sendTicketEmail } from "@/lib/server/ticket-email";
import { registrationFormSchema } from "@/lib/validation/registration";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export interface RegisterFormState {
  error: string | null;
  /** Neutral (non-error-styled) message — currently only ALREADY_REGISTERED. */
  info?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  EVENT_NOT_FOUND: "This event could not be found.",
  EVENT_NOT_PUBLISHED: "Registration for this event is not open.",
  REGISTRATION_CLOSED: "The registration deadline for this event has passed.",
  CAPACITY_REACHED: "This event has reached its registration capacity.",
  UNKNOWN: "Something went wrong. Please try again in a moment.",
};

// Deliberately not in ERROR_MESSAGES: ALREADY_REGISTERED is not an
// error, and its message is rendered via `info`, not `error` — see the
// SECURITY note on RegisterAttendeeResult in lib/server/registration.ts
// for why this path must never carry a ticket token or redirect to one.
const ALREADY_REGISTERED_MESSAGE =
  "This email is already registered for this event. Check your inbox for your original confirmation email with your ticket.";

export async function register(
  eventId: string,
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const { allowed } = checkRateLimit(`register:${ip}`, 10, 10 * 60_000);
  if (!allowed) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  const parsed = registrationFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  if (parsed.data.website) {
    // Honeypot tripped — pretend nothing happened rather than
    // revealing the anti-spam mechanism.
    return { error: "Something went wrong. Please try again." };
  }

  const result = await registerAttendee({
    eventId,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    email: parsed.data.email,
    company: parsed.data.company || undefined,
    position: parsed.data.position || undefined,
  });

  if (!result.ok) {
    if (result.error === "ALREADY_REGISTERED") {
      return { error: null, info: ALREADY_REGISTERED_MESSAGE };
    }
    return { error: ERROR_MESSAGES[result.error] };
  }

  await sendTicketEmail(result.publicToken).catch((err) => {
    console.error("[registration] confirmation email failed", err);
  });

  redirect(`/t/${result.publicToken}`);
}
