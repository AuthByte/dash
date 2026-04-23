import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() ?? "";
const SUPABASE_DATA_TABLE = process.env.SUPABASE_DATA_TABLE?.trim() || "person_datasets";
const SUPABASE_PEOPLE_TABLE =
  process.env.SUPABASE_PEOPLE_TABLE?.trim() || "people";

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

export function getSupabaseDataTableName(): string {
  return SUPABASE_DATA_TABLE;
}

export function getSupabasePeopleTableName(): string {
  return SUPABASE_PEOPLE_TABLE;
}
