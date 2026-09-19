import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * Use ONLY in lib/server/* for the specific unauthenticated flows that
 * need it (public registration, ticket lookup by token, check-in by
 * token) — every query made with this client must apply its own
 * explicit scoping (event_id, status, etc.), since the database will
 * not do it. Never import this in a Client Component or anywhere the
 * `server-only` guard wouldn't catch an accidental client bundle.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
