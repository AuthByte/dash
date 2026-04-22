import "server-only";
import {
  PeopleFileSchema,
  PicksFileSchema,
  PriceEntrySchema,
  SiteMetaSchema,
  ThemesFileSchema,
  type FinancialMetrics,
  type Person,
  type Pick,
  type PriceEntry,
  type SiteMeta,
  type Theme,
  type ThemeSlug,
} from "./schema";
import { supabase } from "./supabase";

export async function getPeople(): Promise<Person[]> {
  const { data, error } = await supabase()
    .from("people")
    .select("slug,name,handle,tagline,accent,active")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });
  if (error) throw new Error(`getPeople: ${error.message}`);
  return PeopleFileSchema.parse(data ?? []);
}

export async function getPersonBySlug(slug: string): Promise<Person | null> {
  const { data, error } = await supabase()
    .from("people")
    .select("slug,name,handle,tagline,accent,active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getPersonBySlug(${slug}): ${error.message}`);
  if (!data) return null;
  if (data.active === false) return null;
  return PeopleFileSchema.parse([data])[0];
}

type TweetEventRow = {
  ticker: string;
  tweet_id: string;
  tweeted_at: string | null;
  tweet_url: string;
  text: string | null;
};

export async function getPicks(personSlug: string): Promise<Pick[]> {
  const client = supabase();
  const [{ data: picksRows, error: picksErr }, { data: eventsRows, error: eventsErr }] =
    await Promise.all([
      client
        .from("picks")
        .select(
          "ticker,name,theme,stance,conviction,thesis_short,thesis_long,first_mentioned_at,tweet_url,tweet_id,exited_at,exit_price,sort_order",
        )
        .eq("person_slug", personSlug)
        .order("sort_order", { ascending: true })
        .order("ticker", { ascending: true }),
      client
        .from("tweet_events")
        .select("ticker,tweet_id,tweeted_at,tweet_url,text")
        .eq("person_slug", personSlug)
        .order("tweeted_at", { ascending: true }),
    ]);

  if (picksErr) throw new Error(`getPicks(${personSlug}): ${picksErr.message}`);
  if (eventsErr)
    throw new Error(`getPicks.events(${personSlug}): ${eventsErr.message}`);

  const eventsByTicker = new Map<string, TweetEventRow[]>();
  for (const ev of (eventsRows ?? []) as TweetEventRow[]) {
    const bucket = eventsByTicker.get(ev.ticker);
    if (bucket) bucket.push(ev);
    else eventsByTicker.set(ev.ticker, [ev]);
  }

  const enriched = (picksRows ?? []).map((p) => ({
    ticker: p.ticker,
    name: p.name ?? "",
    theme: p.theme,
    stance: p.stance,
    conviction: p.conviction,
    thesis_short: p.thesis_short ?? "",
    thesis_long: p.thesis_long ?? "",
    first_mentioned_at: p.first_mentioned_at,
    tweet_url: p.tweet_url ?? "",
    tweet_id: p.tweet_id ?? "",
    exited_at: p.exited_at ?? null,
    exit_price: p.exit_price ?? null,
    tweet_events: (eventsByTicker.get(p.ticker) ?? []).map((ev) => ({
      tweet_id: ev.tweet_id,
      tweet_url: ev.tweet_url ?? "",
      tweeted_at: ev.tweeted_at ?? "",
      ...(ev.text ? { text: ev.text } : {}),
    })),
  }));

  return PicksFileSchema.parse(enriched);
}

export async function getPrices(
  personSlug: string,
): Promise<Record<string, PriceEntry>> {
  const { data, error } = await supabase()
    .from("prices")
    .select("ticker,price,market_cap,currency,ytd_pct,history,metrics,updated_at")
    .eq("person_slug", personSlug);
  if (error) throw new Error(`getPrices(${personSlug}): ${error.message}`);

  const out: Record<string, PriceEntry> = {};
  for (const row of data ?? []) {
    const parsed = PriceEntrySchema.parse({
      price: row.price,
      market_cap: row.market_cap,
      currency: row.currency,
      ytd_pct: Number(row.ytd_pct ?? 0),
      history: row.history ?? [],
      metrics: row.metrics ?? {},
      updated_at:
        typeof row.updated_at === "string"
          ? row.updated_at
          : new Date(row.updated_at).toISOString().slice(0, 10),
    });
    out[row.ticker] = parsed;
  }
  return out;
}

export async function getThemes(personSlug: string): Promise<Theme[]> {
  const { data, error } = await supabase()
    .from("themes")
    .select("slug,label,accent,sort_order")
    .eq("person_slug", personSlug)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getThemes(${personSlug}): ${error.message}`);
  return ThemesFileSchema.parse(data ?? []);
}

export async function getSiteMeta(personSlug: string): Promise<SiteMeta> {
  const { data, error } = await supabase()
    .from("site_meta")
    .select("handle,follower_count,current_thesis_md,claimed_ytd_pct,last_updated")
    .eq("person_slug", personSlug)
    .maybeSingle();
  if (error) throw new Error(`getSiteMeta(${personSlug}): ${error.message}`);
  if (!data) {
    throw new Error(`getSiteMeta(${personSlug}): no site_meta row found`);
  }
  return SiteMetaSchema.parse({
    handle: data.handle,
    follower_count: data.follower_count,
    current_thesis_md: data.current_thesis_md,
    claimed_ytd_pct: Number(data.claimed_ytd_pct ?? 0),
    last_updated:
      typeof data.last_updated === "string"
        ? data.last_updated
        : new Date(data.last_updated).toISOString().slice(0, 10),
  });
}

export type EnrichedPick = Pick & {
  price: number | null;
  market_cap: number | null;
  currency: string;
  ytd_pct: number;
  history: { date: string; close: number }[];
  metrics: FinancialMetrics;
  updated_at: string | null;
};

export async function getEnrichedPicks(
  personSlug: string,
): Promise<EnrichedPick[]> {
  const [picks, prices] = await Promise.all([
    getPicks(personSlug),
    getPrices(personSlug),
  ]);
  return picks.map((p) => {
    const px = prices[p.ticker];
    return {
      ...p,
      price: px?.price ?? null,
      market_cap: px?.market_cap ?? null,
      currency: px?.currency ?? "USD",
      ytd_pct: px?.ytd_pct ?? 0,
      history: px?.history ?? [],
      metrics: px?.metrics ?? {},
      updated_at: px?.updated_at ?? null,
    };
  });
}

export type ThemeStats = {
  theme: Theme;
  count: number;
  avg_ytd_pct: number;
};

export function getThemeStats(
  themes: Theme[],
  picks: EnrichedPick[],
): ThemeStats[] {
  return themes.map((theme) => {
    const inTheme = picks.filter(
      (p) => p.theme === theme.slug && p.stance !== "exited",
    );
    const avg =
      inTheme.length === 0
        ? 0
        : inTheme.reduce((sum, p) => sum + p.ytd_pct, 0) / inTheme.length;
    return {
      theme,
      count: inTheme.length,
      avg_ytd_pct: avg,
    };
  });
}

export type HeadlineStats = {
  total: number;
  long_count: number;
  other_count: number;
  avg_ytd_pct_longs: number;
  best: { ticker: string; ytd_pct: number } | null;
  worst: { ticker: string; ytd_pct: number } | null;
  highest_conviction_count: number;
};

export function getHeadlineStats(picks: EnrichedPick[]): HeadlineStats {
  const longs = picks.filter((p) => p.stance === "long");
  const others = picks.filter((p) => p.stance !== "long");
  const avg =
    longs.length === 0
      ? 0
      : longs.reduce((s, p) => s + p.ytd_pct, 0) / longs.length;
  const sorted = [...picks].sort((a, b) => b.ytd_pct - a.ytd_pct);
  const best = sorted[0]
    ? { ticker: sorted[0].ticker, ytd_pct: sorted[0].ytd_pct }
    : null;
  const worst = sorted[sorted.length - 1]
    ? {
        ticker: sorted[sorted.length - 1].ticker,
        ytd_pct: sorted[sorted.length - 1].ytd_pct,
      }
    : null;
  return {
    total: picks.length,
    long_count: longs.length,
    other_count: others.length,
    avg_ytd_pct_longs: avg,
    best,
    worst,
    highest_conviction_count: picks.filter((p) => p.conviction === "high")
      .length,
  };
}

export function getThemeBySlug(
  themes: Theme[],
  slug: ThemeSlug,
): Theme | undefined {
  return themes.find((t) => t.slug === slug);
}
