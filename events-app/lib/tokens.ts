/**
 * Ticket public_token shape: base64url of 32 random bytes, no padding.
 * Generated server-side in Postgres (register_attendee); this module
 * only validates shape before it's ever used in a query, so a
 * malformed /t/[token] URL (wrong length, bad characters) is rejected
 * without touching the database.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,48}$/;

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
