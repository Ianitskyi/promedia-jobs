import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Builds the public registration form's validation schema with
 * messages in `dict`'s language (the resolved public/event locale —
 * see lib/i18n/server.ts's resolvePublicLocale) — an attendee
 * registering for a Ukrainian event should never see an English
 * validation error.
 */
export function createRegistrationFormSchema(dict: Dictionary) {
  return z.object({
    first_name: z.string().trim().min(1, dict.registration.validationFirstNameRequired).max(120),
    last_name: z.string().trim().min(1, dict.registration.validationLastNameRequired).max(120),
    email: z.email(dict.registration.validationEmail).max(255),
    company: z.string().trim().max(200).optional().or(z.literal("")),
    position: z.string().trim().max(200).optional().or(z.literal("")),
    consent: z.literal("on", { message: dict.registration.validationConsentRequired }),
    // Honeypot: real visitors never fill a field hidden with CSS/aria-hidden.
    // Deliberately unconstrained here — the server action checks it and
    // returns a generic error, rather than this schema surfacing a
    // field-specific validation message that would hint at the mechanism.
    website: z.string().optional().or(z.literal("")),
  });
}
