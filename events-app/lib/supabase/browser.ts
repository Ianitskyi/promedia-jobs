import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/env";

/**
 * Supabase client for use in Client Components (browser). Uses the
 * public anon key only — subject to Row Level Security.
 */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
