import "server-only";
import fs from "node:fs";
import path from "node:path";
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
import {
  isSupabaseDataSource,
  supabaseFetchPeople,
  supabaseFetchPersonBySlug,
  supabaseFetchPicks,
  supabaseFetchPrices,
  supabaseFetchSiteMeta,
  supabaseFetchThemes,
} from "./supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const PEOPLE_DIR = path.join(DATA_DIR, "people");

function readJson<T>(absPath: string): unknown {
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw) as T;
}

async function trySupabase<T>(loader: () => Promise<T | null>): Promise<T | null> {
  if (!isSupabaseDataSource()) return null;
  try {
    return await loader();
  } catch (err) {
    console.error("[data] Supabase read failed, falling back to files:", err);
    return null;
  }
}

function getPeopleFromFiles(): Person[] {
  return PeopleFileSchema.parse(
    readJson(path.join(DATA_DIR, "people.json")),
  ).filter((p) => p.active !== false);
}

export async function getPeople(): Promise<Person[]> {
  const fromDb = await trySupabase(() => supabaseFetchPeople());
  if (fromDb && fromDb.length > 0) return fromDb;
  return getPeopleFromFiles();
}

export async function getPersonBySlug(slug: string): Promise<Person | null> {
  const fromDb = await trySupabase(() => supabaseFetchPersonBySlug(slug));
  if (fromDb) return fromDb;
  return getPeopleFromFiles().find((p) => p.slug === slug) ?? null;
}

function personDir(slug: string): string {
  return path.join(PEOPLE_DIR, slug);
}

export async function getPicks(personSlug: string): Promise<Pick[]> {
  const fromDb = await trySupabase(() => supabaseFetchPicks(personSlug));
  if (fromDb != null) return fromDb;
  return PicksFileSchema.parse(
    readJson(path.join(personDir(personSlug), "picks.json")),
  );
}

export async function getPrices(
  personSlug: string,
): Promise<Record<string, PriceEntry>> {
  const fromDb = await trySupabase(() => supabaseFetchPrices(personSlug));
  if (fromDb != null) return fromDb;
  return PricesFileSchema.parse(
    readJson(path.join(personDir(personSlug), "prices.json")),
  );
}

export async function getThemes(personSlug: string): Promise<Theme[]> {
  const fromDb = await trySupabase(() => supabaseFetchThemes(personSlug));
  if (fromDb != null) return fromDb;
  return ThemesFileSchema.parse(
    readJson(path.join(personDir(personSlug), "themes.json")),
  ).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getSiteMeta(personSlug: string): Promise<SiteMeta> {
  const fromDb = await trySupabase(() => supabaseFetchSiteMeta(personSlug));
  if (fromDb) return fromDb;
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
