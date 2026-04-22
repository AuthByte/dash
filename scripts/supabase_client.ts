import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() ?? "";

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL) return null;
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  return getSupabaseClient();
}
