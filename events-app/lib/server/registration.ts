import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/consent";

export type RegisterAttendeeError =
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_PUBLISHED"
  | "REGISTRATION_CLOSED"
  | "CAPACITY_REACHED"
  | "UNKNOWN";

export interface RegisterAttendeeInput {
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  position?: string;
}

export type RegisterAttendeeResult =
  | { ok: true; publicToken: string; alreadyRegistered: boolean }
  | { ok: false; error: RegisterAttendeeError };

const KNOWN_ERRORS: RegisterAttendeeError[] = [
  "EVENT_NOT_FOUND",
  "EVENT_NOT_PUBLISHED",
  "REGISTRATION_CLOSED",
  "CAPACITY_REACHED",
];

/**
 * The single entry point for public registration. Delegates to the
 * register_attendee Postgres function, which does the atomic
 * lock-check-insert so this call is race-safe under concurrent
 * registrations for the same event.
 */
export async function registerAttendee(
  input: RegisterAttendeeInput,
): Promise<RegisterAttendeeResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("register_attendee", {
    p_event_id: input.eventId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_company: input.company ?? null,
    p_position: input.position ?? null,
    p_consent_version: CONSENT_VERSION,
    p_consent_text: CONSENT_TEXT,
  });

  if (error) {
    const message = error.message as string;
    const known = KNOWN_ERRORS.find((code) => message.includes(code));
    return { ok: false, error: known ?? "UNKNOWN" };
  }

  if (!data) {
    return { ok: false, error: "UNKNOWN" };
  }

  return {
    ok: true,
    publicToken: data.public_token,
    alreadyRegistered: data.already_registered,
  };
}
