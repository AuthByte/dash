import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() ?? "";
const SUPABASE_PEOPLE_TABLE =
  process.env.SUPABASE_PEOPLE_TABLE?.trim() || "tracker_people";
const SUPABASE_PROFILE_TABLE =
  process.env.SUPABASE_PROFILE_TABLE?.trim() || "person_datasets";

export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL) && Boolean(
    SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  );
}

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

export type SupabasePersonDataset = {
  picks: unknown;
  prices: unknown;
  themes: unknown;
  site_meta: unknown;
};

export async function readSupabasePeople(): Promise<unknown> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from(SUPABASE_PEOPLE_TABLE)
    .select("slug,name,handle,tagline,accent,active")
    .order("slug", { ascending: true });

  if (error) throw new Error(`Supabase people read failed: ${error.message}`);
  return data ?? [];
}

export async function readSupabasePersonDataset(
  slug: string,
): Promise<SupabasePersonDataset | null> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const isTrackerProfiles = SUPABASE_PROFILE_TABLE === "tracker_profiles";
  const slugColumn = isTrackerProfiles ? "slug" : "person_slug";
  const selectCols = isTrackerProfiles
    ? "picks,prices,themes,site_meta"
    : "picks,prices,themes,site_meta";
  const { data, error } = await client
    .from(SUPABASE_PROFILE_TABLE)
    .select(selectCols)
    .eq(slugColumn, slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase profile read failed for ${slug}: ${error.message}`);
  }
  return (data as SupabasePersonDataset | null) ?? null;
}
