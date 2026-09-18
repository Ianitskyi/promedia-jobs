/**
 * Registration consent text, versioned. Each registration stores a
 * snapshot of this text and the version at the time of consent
 * (registration_consents table), so changing the copy here never
 * affects the audit trail of past registrations — only new ones.
 */
export const CONSENT_VERSION = "2026-01";
export const CONSENT_TEXT =
  "I agree that my information will be processed for the purpose of registration and participation in this event.";
