import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/consent";

export type RegisterAttendeeError =
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_PUBLISHED"
  | "REGISTRATION_CLOSED"
  | "CAPACITY_REACHED"
  | "ALREADY_REGISTERED"
  | "UNKNOWN";

export interface RegisterAttendeeInput {
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  position?: string;
}

/**
 * SECURITY: on success this is the only place a ticket's public_token
 * ever leaves the server for a *new* registration. A duplicate
 * registration (an email already registered for this event) is
 * reported as the ALREADY_REGISTERED error below — never as a success
 * carrying the existing token. The token is a bearer credential; if
 * knowing someone's email were enough to get their ticket token back,
 * anyone who knew a registered attendee's email could obtain (and use)
 * their ticket. See the SECURITY note on register_attendee in
 * supabase/migrations/0001_init.sql.
 *
 * A future "resend my ticket" flow belongs here as a separate,
 * explicitly-invoked function (e.g. requestTicketResend(eventId, email)
 * that always responds the same way regardless of whether the email is
 * registered, and emails the link rather than returning it) — not as a
 * side effect of registration. Not implemented yet; deliberately out of
 * scope for this fix.
 */
export type RegisterAttendeeResult =
  | { ok: true; publicToken: string }
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

  if (data.already_registered) {
    return { ok: false, error: "ALREADY_REGISTERED" };
  }

  if (!data.public_token) {
    // Defensive: a fresh registration should always carry a token.
    return { ok: false, error: "UNKNOWN" };
  }

  return { ok: true, publicToken: data.public_token };
}
