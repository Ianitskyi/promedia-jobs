"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerAttendee } from "@/lib/server/registration";
import { sendTicketEmail } from "@/lib/server/ticket-email";
import { registrationFormSchema } from "@/lib/validation/registration";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export interface RegisterFormState {
  error: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  EVENT_NOT_FOUND: "This event could not be found.",
  EVENT_NOT_PUBLISHED: "Registration for this event is not open.",
  REGISTRATION_CLOSED: "The registration deadline for this event has passed.",
  CAPACITY_REACHED: "This event has reached its registration capacity.",
  UNKNOWN: "Something went wrong. Please try again in a moment.",
};

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
    return { error: ERROR_MESSAGES[result.error] };
  }

  if (!result.alreadyRegistered) {
    await sendTicketEmail(result.publicToken).catch((err) => {
      console.error("[registration] confirmation email failed", err);
    });
  }

  redirect(
    result.alreadyRegistered
      ? `/t/${result.publicToken}?existing=1`
      : `/t/${result.publicToken}`,
  );
}
