import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  FinancialMetricsSchema,
  PersonSchema,
  PickSchema,
  PriceEntrySchema,
  SiteMetaSchema,
  ThemeSchema,
  type FinancialMetrics,
  type Person,
  type Pick,
  type PriceEntry,
  type SiteMeta,
  type Theme,
} from "./schema";

function supabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
}

function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

export function isSupabaseDataSource(): boolean {
  return Boolean(supabaseUrl() && serviceRoleKey());
}

function createServerClient() {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function num(v: unknown, fallback = 0): number {
  return numOrNull(v) ?? fallback;
}

/** YYYY-MM-DD or timestamptz → ISO-ish string for the app */
function dateStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return v;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return "";
}

function tweetedAtStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return v;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString();
  }
  return "";
}

function parseHistory(raw: unknown): { date: string; close: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { date: string; close: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const d = typeof o.date === "string" ? o.date.slice(0, 10) : "";
    const c = numOrNull(o.close);
    if (d && c != null) out.push({ date: d, close: c });
  }
  return out;
}

function parseMetrics(raw: unknown): FinancialMetrics {
  const parsed = FinancialMetricsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

function mapPersonRow(row: Record<string, unknown>): Person {
  return PersonSchema.parse({
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    handle: String(row.handle ?? ""),
    tagline: String(row.tagline ?? ""),
    accent: String(row.accent ?? ""),
    active: row.active !== false,
  });
}

export async function supabaseFetchPeople(): Promise<Person[] | null> {
  const client = createServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("people")
    .select("slug,name,handle,tagline,accent,active,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  if (!data?.length) return null;
  return data.map((row) => mapPersonRow(row as Record<string, unknown>));
}

export async function supabaseFetchPersonBySlug(
  slug: string,
): Promise<Person | null> {
  const client = createServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("people")
    .select("slug,name,handle,tagline,accent,active,sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (row.active === false) return null;
  return mapPersonRow(row);
}

export async function supabaseFetchPicks(personSlug: string): Promise<Pick[] | null> {
  const client = createServerClient();
  if (!client) return null;
  const [{ data: pickRows, error: pErr }, { data: eventRows, error: eErr }] =
    await Promise.all([
      client
        .from("picks")
        .select("*")
        .eq("person_slug", personSlug)
        .order("sort_order", { ascending: true, nullsFirst: false }),
      client
        .from("tweet_events")
        .select("ticker,tweet_id,tweeted_at,tweet_url,text")
        .eq("person_slug", personSlug)
        .order("tweeted_at", { ascending: false }),
    ]);
  if (pErr) throw pErr;
  if (eErr) throw eErr;
  if (pickRows == null) return null;
  if (pickRows.length === 0) return [];

  const byTicker = new Map<
    string,
    { tweet_id: string; tweeted_at: string; tweet_url: string; text?: string }[]
  >();
  for (const ev of eventRows ?? []) {
    const r = ev as Record<string, unknown>;
    const ticker = String(r.ticker ?? "");
    if (!ticker) continue;
    const list = byTicker.get(ticker) ?? [];
    list.push({
      tweet_id: String(r.tweet_id ?? ""),
      tweeted_at: tweetedAtStr(r.tweeted_at),
      tweet_url:
        typeof r.tweet_url === "string"
          ? r.tweet_url
          : String(r.tweet_url ?? ""),
      text: typeof r.text === "string" ? r.text : undefined,
    });
    byTicker.set(ticker, list);
  }

  const picks: Pick[] = [];
  for (const raw of pickRows) {
    const row = raw as Record<string, unknown>;
    const ticker = String(row.ticker ?? "");
    const mergedEvents = byTicker.get(ticker);
    const pick = PickSchema.parse({
      ticker,
      name: String(row.name ?? ""),
      theme: row.theme,
      stance: row.stance,
      conviction: row.conviction,
      thesis_short: String(row.thesis_short ?? ""),
      thesis_long: String(row.thesis_long ?? ""),
      first_mentioned_at: dateStr(row.first_mentioned_at),
      tweet_url:
        typeof row.tweet_url === "string"
          ? row.tweet_url
          : String(row.tweet_url ?? ""),
      tweet_id: String(row.tweet_id ?? ""),
      tweet_events:
        mergedEvents && mergedEvents.length > 0 ? mergedEvents : undefined,
      exited_at: row.exited_at != null ? dateStr(row.exited_at) : null,
      exit_price: numOrNull(row.exit_price),
    });
    picks.push(pick);
  }
  return picks;
}

export async function supabaseFetchPrices(
  personSlug: string,
): Promise<Record<string, PriceEntry> | null> {
  const client = createServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("prices")
    .select("*")
    .eq("person_slug", personSlug);
  if (error) throw error;
  if (data == null) return null;
  if (data.length === 0) return {};
  const out: Record<string, PriceEntry> = {};
  for (const raw of data) {
    const row = raw as Record<string, unknown>;
    const ticker = String(row.ticker ?? "");
    if (!ticker) continue;
    out[ticker] = PriceEntrySchema.parse({
      price: numOrNull(row.price),
      market_cap: numOrNull(row.market_cap),
      currency: typeof row.currency === "string" ? row.currency : "USD",
      ytd_pct: num(row.ytd_pct),
      history: parseHistory(row.history),
      updated_at:
        dateStr(row.updated_at) ||
        new Date().toISOString().slice(0, 10),
      metrics: parseMetrics(row.metrics),
    });
  }
  return out;
}

export async function supabaseFetchThemes(
  personSlug: string,
): Promise<Theme[] | null> {
  const client = createServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("themes")
    .select("slug,label,accent,sort_order")
    .eq("person_slug", personSlug)
    .order("sort_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  if (data == null) return null;
  if (data.length === 0) return [];
  return data.map((row) =>
    ThemeSchema.parse({
      slug: (row as Record<string, unknown>).slug,
      label: String((row as Record<string, unknown>).label ?? ""),
      accent: String((row as Record<string, unknown>).accent ?? ""),
      sort_order: num((row as Record<string, unknown>).sort_order, 0),
    }),
  );
}

export async function supabaseFetchSiteMeta(
  personSlug: string,
): Promise<SiteMeta | null> {
  const client = createServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("site_meta")
    .select("handle,follower_count,current_thesis_md,claimed_ytd_pct,last_updated")
    .eq("person_slug", personSlug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return SiteMetaSchema.parse({
    handle: String(row.handle ?? ""),
    follower_count: Math.round(num(row.follower_count, 0)),
    current_thesis_md: String(row.current_thesis_md ?? ""),
    claimed_ytd_pct: num(row.claimed_ytd_pct),
    last_updated: dateStr(row.last_updated),
  });
}
