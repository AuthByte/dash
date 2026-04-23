import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
  process.env.SUPABASE_URL?.trim() ??
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
  process.env.SUPABASE_ANON_KEY?.trim() ??
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
  "";

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
    global: {
      headers: {
        "x-application-name": "picks-tracker-web",
      },
    },
  });
}

/** App-side reader: requires URL + anon (or service) key; throws if missing. */
let _appClient: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_appClient) return _appClient;
  if (!SUPABASE_URL) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL). Copy .env.example to .env.local and fill it in.",
    );
  }
  if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY). Copy .env.example to .env.local and fill it in.",
    );
  }
  const key = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  _appClient = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        "x-application-name": "picks-tracker-web",
      },
    },
  });
  return _appClient;
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
    .select("slug,name,handle,tagline,accent,active,sort_order")
    .order("sort_order", { ascending: true })
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
  const { data, error } = await client
    .from(SUPABASE_PROFILE_TABLE)
    .select("picks,prices,themes,site_meta")
    .eq(slugColumn, slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase profile read failed for ${slug}: ${error.message}`);
  }
  return (data as SupabasePersonDataset | null) ?? null;
}
