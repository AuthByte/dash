import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(__dirname, "..");
config({ path: path.join(ROOT, ".env.local") });
config({ path: path.join(ROOT, ".env") });

export function getSupabaseServiceClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
