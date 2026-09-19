/**
 * Centralised, defensive access to the Supabase connection settings.
 *
 * A misconfigured `NEXT_PUBLIC_SUPABASE_URL` is the most common cause of
 * an opaque `TypeError: fetch failed` at runtime: a value pasted into a
 * dashboard (Vercel, CI) very often arrives with a trailing newline or
 * stray whitespace, which makes the URL unroutable and every Supabase
 * request — including `auth.signUp` — throw `fetch failed` with no hint
 * as to why. Trimming here turns that whole class of failure into a
 * working request, and a genuinely missing variable into a clear,
 * secret-free error instead of a parse/network error deep in a vendor
 * library.
 *
 * These values are read from the environment only; nothing here logs or
 * returns a secret.
 */

export function trimRequired(name: string, raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in your ` +
        `deployment environment (see events-app/.env.example).`,
    );
  }
  return value;
}

// NOTE: `NEXT_PUBLIC_*` variables must be referenced as static property
// accesses (`process.env.NEXT_PUBLIC_SUPABASE_URL`), never via a dynamic
// key, so Next.js can inline them into the browser bundle at build time.

/** Public Supabase project URL, trimmed of stray whitespace/newlines. */
export function getSupabaseUrl(): string {
  return trimRequired(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/** Public (anon) Supabase key, trimmed of stray whitespace/newlines. */
export function getSupabaseAnonKey(): string {
  return trimRequired(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Service-role key. Server-only — callers must already be inside a
 * `server-only` module (see lib/supabase/admin.ts). Never exposed to or
 * imported by client code.
 */
export function getSupabaseServiceRoleKey(): string {
  return trimRequired(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
