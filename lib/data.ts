import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  hasSupabaseConfig,
  readSupabasePersonDataset,
  readSupabasePeople,
  supabase,
  SUPABASE_PEOPLE_TABLE,
  type SupabasePersonDataset,
} from "./supabase";
import {
  PeopleFileSchema,
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
import { parsePickRows } from "./pickParse";
import { capHistory, dateOnly } from "./history";

export { getHeadlineStats, type HeadlineStats } from "./stats";

const DATA_DIR = path.join(process.cwd(), "data");
const PEOPLE_DIR = path.join(DATA_DIR, "people");

function readJsonFile(absPath: string): unknown | null {
  if (!fs.existsSync(absPath)) return null;
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw) as unknown;
}

function personDir(slug: string): string {
  return path.join(PEOPLE_DIR, slug);
}

const SUPABASE_TIMEOUT_MS = 8_000;

async function withTimeout<T>(promise: PromiseLike<T>, ms = SUPABASE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emptySiteMeta(handle = ""): SiteMeta {
  return {
    handle,
    follower_count: 0,
    current_thesis_md: "",
    claimed_ytd_pct: 0,
    last_updated: new Date().toISOString().slice(0, 10),
  };
}

async function getSupabaseDataset(
  personSlug: string,
): Promise<SupabasePersonDataset | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    return await withTimeout(readSupabasePersonDataset(personSlug));
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
      await withTimeout(
        Promise.all([
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
        ]),
      );

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

    return parsePickRows(enriched);
  } catch {
    return null;
  }
}

async function getPricesFromNormalizedTables(
  personSlug: string,
): Promise<Record<string, PriceEntry> | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const { data, error } = await withTimeout(
      supabase()
        .from("prices")
        .select("ticker,price,market_cap,currency,ytd_pct,history,metrics,updated_at")
        .eq("person_slug", personSlug),
    );
    if (error) return null;

    const out: Record<string, PriceEntry> = {};
    for (const row of data ?? []) {
      const parsed = PriceEntrySchema.safeParse({
        price: row.price,
        market_cap: row.market_cap,
        currency: row.currency ?? "USD",
        ytd_pct: Number(row.ytd_pct ?? 0),
        history: Array.isArray(row.history)
          ? row.history
              .map((point: { date?: unknown; close?: unknown }) => {
                const day = dateOnly(typeof point?.date === "string" ? point.date : "");
                const close = Number(point?.close);
                if (!day || !Number.isFinite(close)) return null;
                return { date: day, close };
              })
              .filter(
                (point: { date: string; close: number } | null): point is { date: string; close: number } =>
                  point != null,
              )
          : [],
        metrics: row.metrics ?? {},
        updated_at:
          typeof row.updated_at === "string"
            ? row.updated_at
            : row.updated_at
              ? new Date(row.updated_at).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
      });
      if (!parsed.success || typeof row.ticker !== "string") continue;
      out[row.ticker] = parsed.data;
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
    const { data, error } = await withTimeout(
      supabase()
        .from("themes")
        .select("slug,label,accent,sort_order")
        .eq("person_slug", personSlug)
        .order("sort_order", { ascending: true }),
    );
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
    const { data, error } = await withTimeout(
      supabase()
        .from("site_meta")
        .select("handle,follower_count,current_thesis_md,claimed_ytd_pct,last_updated")
        .eq("person_slug", personSlug)
        .maybeSingle(),
    );
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
      const rows = await withTimeout(
        supabase()
          .from(SUPABASE_PEOPLE_TABLE)
          .select("slug,name,handle,tagline,accent,active,sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("slug", { ascending: true }),
      );
      if (!rows.error && rows.data != null && rows.data.length > 0) {
        return PeopleFileSchema.parse(rows.data).filter((p) => p.active !== false);
      }
    } catch {
      // fall through
    }
    try {
      const supabasePeople = await withTimeout(readSupabasePeople());
      const parsed = PeopleFileSchema.parse(supabasePeople).filter((p) => p.active !== false);
      if (parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }

  const peoplePath = path.join(DATA_DIR, "people.json");
  const local = readJsonFile(peoplePath);
  if (local) {
    return PeopleFileSchema.parse(local).filter((p) => p.active !== false);
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
    return parsePickRows(dataset.picks);
  }
  const local = readJsonFile(path.join(personDir(personSlug), "picks.json"));
  if (local) return parsePickRows(local);
  return [];
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
  const local = readJsonFile(path.join(personDir(personSlug), "prices.json"));
  if (local) return PricesFileSchema.parse(local);
  return {};
}

export async function getThemes(personSlug: string): Promise<Theme[]> {
  const normalized = await getThemesFromNormalizedTables(personSlug);
  if (normalized && normalized.length > 0) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.themes) {
    return ThemesFileSchema.parse(dataset.themes).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  }
  const local = readJsonFile(path.join(personDir(personSlug), "themes.json"));
  if (local) {
    return ThemesFileSchema.parse(local).sort((a, b) => a.sort_order - b.sort_order);
  }
  return [];
}

export async function getSiteMeta(personSlug: string): Promise<SiteMeta> {
  const normalized = await getSiteMetaFromNormalizedTables(personSlug);
  if (normalized) return normalized;

  const dataset = await getSupabaseDataset(personSlug);
  if (dataset?.site_meta) {
    return SiteMetaSchema.parse(dataset.site_meta);
  }
  const local = readJsonFile(path.join(personDir(personSlug), "site_meta.json"));
  if (local) return SiteMetaSchema.parse(local);
  const people = await getPeople();
  const handle = people.find((p) => p.slug === personSlug)?.handle ?? personSlug;
  return emptySiteMeta(handle);
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
      history: includeHistory ? capHistory(px?.history ?? []) : [],
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
    history: capHistory(px?.history ?? []),
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

