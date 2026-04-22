import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  hasSupabaseConfig,
  readSupabasePersonDataset,
  readSupabasePeople,
  type SupabasePersonDataset,
} from "./supabase";
import {
  PeopleFileSchema,
  PicksFileSchema,
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

async function getSupabaseDataset(personSlug: string): Promise<SupabasePersonDataset | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    return await readSupabasePersonDataset(personSlug);
  } catch {
    return null;
  }
}

export async function getPeople(): Promise<Person[]> {
  if (hasSupabaseConfig()) {
    try {
      const supabasePeople = await readSupabasePeople();
      return PeopleFileSchema.parse(supabasePeople).filter((p) => p.active !== false);
    } catch {
      // Fall back to file storage to keep the app serving.
    }
  }
  return PeopleFileSchema.parse(readJson(path.join(DATA_DIR, "people.json"))).filter(
    (p) => p.active !== false,
  );
}

export async function getPersonBySlug(slug: string): Promise<Person | null> {
  return (await getPeople()).find((p) => p.slug === slug) ?? null;
}

function personDir(slug: string): string {
  return path.join(PEOPLE_DIR, slug);
}

export async function getPicks(personSlug: string): Promise<Pick[]> {
  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.picks) {
    return PicksFileSchema.parse(dataset.picks);
  }
  return PicksFileSchema.parse(readJson(path.join(personDir(personSlug), "picks.json")));
}

export async function getPrices(personSlug: string): Promise<Record<string, PriceEntry>> {
  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.prices) {
    return PricesFileSchema.parse(dataset.prices);
  }
  return PricesFileSchema.parse(readJson(path.join(personDir(personSlug), "prices.json")));
}

export async function getThemes(personSlug: string): Promise<Theme[]> {
  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.themes) {
    return ThemesFileSchema.parse(dataset.themes).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  }
  return ThemesFileSchema.parse(readJson(path.join(personDir(personSlug), "themes.json"))).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export async function getSiteMeta(personSlug: string): Promise<SiteMeta> {
  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.site_meta) {
    return SiteMetaSchema.parse(dataset.site_meta);
  }
  return SiteMetaSchema.parse(readJson(path.join(personDir(personSlug), "site_meta.json")));
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

export async function getThemeStats(
  personSlug: string,
  picks: EnrichedPick[],
): Promise<ThemeStats[]> {
  const themes = await getThemes(personSlug);
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

