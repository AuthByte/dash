import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  hasSupabaseConfig,
  readSupabasePersonDataset,
  readSupabasePeople,
  supabase,
  type SupabasePersonDataset,
} from "./supabase";
import {
  PeopleFileSchema,
  PicksFileSchema,
  PriceEntrySchema,
  PricesFileSchema,
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

const DATA_DIR = path.join(process.cwd(), "data");
const PEOPLE_DIR = path.join(DATA_DIR, "people");

function readJson<T>(absPath: string): unknown {
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw) as T;
}

function personDir(slug: string): string {
  return path.join(PEOPLE_DIR, slug);
}

async function getSupabaseDataset(
  personSlug: string,
): Promise<SupabasePersonDataset | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    return await readSupabasePersonDataset(personSlug);
  } catch {
    return null;
  }
}

type TweetEventRow = {
  ticker: string;
  tweet_id: string;
  tweeted_at: string | null;
  tweet_url: string;
  text: string | null;
};

async function getPicksFromNormalizedTables(
  personSlug: string,
): Promise<Pick[] | null> {
  if (!hasSupabaseConfig()) return null;
  try {
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

    if (picksErr || eventsErr) return null;

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
  } catch {
    return null;
  }
}

async function getPricesFromNormalizedTables(
  personSlug: string,
): Promise<Record<string, PriceEntry> | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const { data, error } = await supabase()
      .from("prices")
      .select("ticker,price,market_cap,currency,ytd_pct,history,metrics,updated_at")
      .eq("person_slug", personSlug);
    if (error) return null;

    const out: Record<string, PriceEntry> = {};
    for (const row of data ?? []) {
      out[row.ticker] = PriceEntrySchema.parse({
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
    }
    return out;
  } catch {
    return null;
  }
}

async function getThemesFromNormalizedTables(
  personSlug: string,
): Promise<Theme[] | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const { data, error } = await supabase()
      .from("themes")
      .select("slug,label,accent,sort_order")
      .eq("person_slug", personSlug)
      .order("sort_order", { ascending: true });
    if (error) return null;
    return ThemesFileSchema.parse(data ?? []);
  } catch {
    return null;
  }
}

async function getSiteMetaFromNormalizedTables(
  personSlug: string,
): Promise<SiteMeta | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const { data, error } = await supabase()
      .from("site_meta")
      .select("handle,follower_count,current_thesis_md,claimed_ytd_pct,last_updated")
      .eq("person_slug", personSlug)
      .maybeSingle();
    if (error || !data) return null;
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
  } catch {
    return null;
  }
}

export async function getPeople(): Promise<Person[]> {
  if (hasSupabaseConfig()) {
    try {
      const rows = await supabase()
        .from("people")
        .select("slug,name,handle,tagline,accent,active,sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true });
      if (!rows.error && rows.data != null) {
        return PeopleFileSchema.parse(rows.data).filter((p) => p.active !== false);
      }
    } catch {
      // fall through
    }
    try {
      const supabasePeople = await readSupabasePeople();
      return PeopleFileSchema.parse(supabasePeople).filter((p) => p.active !== false);
    } catch {
      // fall through
    }
  }

  const peoplePath = path.join(DATA_DIR, "people.json");
  if (fs.existsSync(peoplePath)) {
    return PeopleFileSchema.parse(readJson(peoplePath)).filter(
      (p) => p.active !== false,
    );
  }
  return [];
}

export async function getPersonBySlug(slug: string): Promise<Person | null> {
  return (await getPeople()).find((p) => p.slug === slug) ?? null;
}

export async function getPicks(personSlug: string): Promise<Pick[]> {
  const normalized = await getPicksFromNormalizedTables(personSlug);
  if (normalized) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.picks) {
    return PicksFileSchema.parse(dataset.picks);
  }
  return PicksFileSchema.parse(
    readJson(path.join(personDir(personSlug), "picks.json")),
  );
}

export async function getPrices(
  personSlug: string,
): Promise<Record<string, PriceEntry>> {
  const normalized = await getPricesFromNormalizedTables(personSlug);
  if (normalized) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.prices) {
    return PricesFileSchema.parse(dataset.prices);
  }
  return PricesFileSchema.parse(
    readJson(path.join(personDir(personSlug), "prices.json")),
  );
}

export async function getThemes(personSlug: string): Promise<Theme[]> {
  const normalized = await getThemesFromNormalizedTables(personSlug);
  if (normalized) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.themes) {
    return ThemesFileSchema.parse(dataset.themes).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  }
  return ThemesFileSchema.parse(
    readJson(path.join(personDir(personSlug), "themes.json")),
  ).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getSiteMeta(personSlug: string): Promise<SiteMeta> {
  const normalized = await getSiteMetaFromNormalizedTables(personSlug);
  if (normalized) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.site_meta) {
    return SiteMetaSchema.parse(dataset.site_meta);
  }
  return SiteMetaSchema.parse(
    readJson(path.join(personDir(personSlug), "site_meta.json")),
  );
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

export type TweetMarker = {
  tweet_id: string;
  tweet_url: string;
  tweeted_at: string;
};

export function getTweetMarkersForPick(pick: Pick): TweetMarker[] {
  if (pick.tweet_events && pick.tweet_events.length > 0) {
    return pick.tweet_events
      .filter((event) => event.tweeted_at)
      .map((event) => ({
        tweet_id: event.tweet_id,
        tweet_url: event.tweet_url,
        tweeted_at: event.tweeted_at,
      }))
      .sort((a, b) => a.tweeted_at.localeCompare(b.tweeted_at));
  }
  if (!pick.first_mentioned_at) return [];
  return [
    {
      tweet_id: pick.tweet_id,
      tweet_url: pick.tweet_url,
      tweeted_at: pick.first_mentioned_at,
    },
  ];
}

export async function getEnrichedPicks(
  personSlug: string,
  options?: { includeHistory?: boolean },
): Promise<EnrichedPick[]> {
  const picks = await getPicks(personSlug);
  const prices = await getPrices(personSlug);
  const includeHistory = options?.includeHistory ?? true;
  return picks.map((p) => {
    const px = prices[p.ticker];
    return {
      ...p,
      price: px?.price ?? null,
      market_cap: px?.market_cap ?? null,
      currency: px?.currency ?? "USD",
      ytd_pct: px?.ytd_pct ?? 0,
      history: includeHistory ? (px?.history ?? []) : [],
      metrics: px?.metrics ?? {},
      updated_at: px?.updated_at ?? null,
    };
  });
}

export async function getEnrichedPick(
  personSlug: string,
  ticker: string,
): Promise<EnrichedPick | null> {
  const picks = await getPicks(personSlug);
  const pick = picks.find((p) => p.ticker === ticker);
  if (!pick) return null;
  const prices = await getPrices(personSlug);
  const px = prices[ticker];
  return {
    ...pick,
    price: px?.price ?? null,
    market_cap: px?.market_cap ?? null,
    currency: px?.currency ?? "USD",
    ytd_pct: px?.ytd_pct ?? 0,
    history: px?.history ?? [],
    metrics: px?.metrics ?? {},
    updated_at: px?.updated_at ?? null,
  };
}

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

export type ThemeStats = {
  theme: Theme;
  count: number;
  avg_ytd_pct: number;
};

export type HeadlineStats = {
  total: number;
  long_count: number;
  other_count: number;
  avg_ytd_pct_longs: number;
  best: { ticker: string; ytd_pct: number } | null;
  worst: { ticker: string; ytd_pct: number } | null;
  highest_conviction_count: number;
};
