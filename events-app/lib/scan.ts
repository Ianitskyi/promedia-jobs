import { isValidTokenFormat } from "@/lib/tokens";

/**
 * The QR encodes a full ticket URL (…/t/<token>). Pulls the token back
 * out client-side purely for display/UX — the server re-derives and
 * re-validates everything from the raw string it's sent, so a
 * malformed extraction here just becomes an "invalid ticket" result,
 * never a trust boundary.
 */
export function extractTokenFromScan(scanned: string): string | null {
  const trimmed = scanned.trim();

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const candidate = segments[segments.length - 1];
    if (candidate && isValidTokenFormat(candidate)) return candidate;
  } catch {
    // Not a URL — maybe the raw token was encoded directly.
  }

  if (isValidTokenFormat(trimmed)) return trimmed;
  return null;
}
