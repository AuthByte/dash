/**
 * Refresh price/marketcap/YTD/history + fundamentals for every ticker
 * in data/people/<person>/picks.json.
 *
 *   pnpm refresh                          # refresh all people in data/people.json
 *   pnpm refresh -- --person serenity     # only one person
 *   pnpm refresh -- --ticker IQE.L        # only one ticker (across all people)
 *
 * Uses FMP stable endpoints only. Any unsupported symbols fail clearly so
 * subscription coverage issues are visible immediately.
 */
import fs from "node:fs";
import path from "node:path";
import {
  PeopleFileSchema,
  PicksFileSchema,
  PricesFileSchema,
  type FinancialMetrics,
  type PriceEntry,
} from "../lib/schema";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const PEOPLE_DIR = path.join(DATA_DIR, "people");
const PEOPLE_FILE = path.join(DATA_DIR, "people.json");

const RATE_LIMIT_MS = 350;
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const FMP_API_KEY = process.env.FMP_API_KEY?.trim() ?? "";

const DEFAULT_CURRENCY: Record<string, string> = {
  ".L": "GBp",
  ".ST": "SEK",
  ".PA": "EUR",
  ".HK": "HKD",
  ".TO": "CAD",
};

type FmpQuote = {
  symbol?: unknown;
  price?: unknown;
  marketCap?: unknown;
  currency?: unknown;
  previousClose?: unknown;
  open?: unknown;
  dayHigh?: unknown;
  dayLow?: unknown;
  changePercentage?: unknown;
  volume?: unknown;
  averageVolume?: unknown;
  yearHigh?: unknown;
  yearLow?: unknown;
  priceAvg50?: unknown;
  priceAvg200?: unknown;
  exchange?: unknown;
};

type FmpProfile = {
  symbol?: unknown;
  price?: unknown;
  marketCap?: unknown;
  currency?: unknown;
  previousClose?: unknown;
  open?: unknown;
  dayHigh?: unknown;
  dayLow?: unknown;
  changePercentage?: unknown;
  volume?: unknown;
  averageVolume?: unknown;
  yearHigh?: unknown;
  yearLow?: unknown;
  priceAvg50?: unknown;
  priceAvg200?: unknown;
  exchange?: unknown;
  beta?: unknown;
  lastDividend?: unknown;
  sector?: unknown;
  industry?: unknown;
  exchangeFullName?: unknown;
};

type FmpHistoryPoint = {
  date?: unknown;
  price?: unknown;
};

class FmpUnsupportedSymbolError extends Error {
  constructor(ticker: string, detail: string) {
    super(`FMP unsupported symbol ${ticker}: ${detail}`);
    this.name = "FmpUnsupportedSymbolError";
  }
}

function inferCurrency(ticker: string): string {
  for (const suffix of Object.keys(DEFAULT_CURRENCY)) {
    if (ticker.endsWith(suffix)) return DEFAULT_CURRENCY[suffix];
  }
  return "USD";
}

function jan1ISO(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function yearsAgoISO(years: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear() - years,
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
}

function parseArgs(argv: string[]): { ticker?: string; person?: string } {
  const out: { ticker?: string; person?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ticker" && argv[i + 1]) {
      out.ticker = argv[++i];
    } else if (argv[i] === "--person" && argv[i + 1]) {
      out.person = argv[++i];
    }
  }
  return out;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  // Some providers return { raw, fmt } shapes
  if (typeof v === "object" && v !== null && "raw" in v) {
    const raw = (v as { raw: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function dateOnly(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    const body = text.slice(0, 240);
    if (res.status === 402) {
      throw new FmpUnsupportedSymbolError("unknown", body);
    }
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return JSON.parse(text) as T;
}

function withFmpKey(endpoint: string): string {
  const joiner = endpoint.includes("?") ? "&" : "?";
  return `${FMP_BASE_URL}${endpoint}${joiner}apikey=${encodeURIComponent(FMP_API_KEY)}`;
}

function calculateYtdPct(
  price: number | null,
  history: { date: string; close: number }[],
): number {
  if (price == null || history.length === 0) return 0;
  const jan1Ms = jan1ISO().getTime();
  const ytdStart =
    history.find((point) => {
      const ms = Date.parse(point.date);
      return !Number.isNaN(ms) && ms >= jan1Ms;
    }) ?? history[history.length - 1];
  const start = ytdStart?.close;
  if (!start || start <= 0) return 0;
  return Number((((price - start) / start) * 100).toFixed(2));
}

function buildFmpMetrics(
  quote: FmpQuote,
  profile: FmpProfile | null,
): FinancialMetrics {
  return {
    prev_close: num(quote.previousClose),
    open: num(quote.open),
    day_high: num(quote.dayHigh),
    day_low: num(quote.dayLow),
    day_change_pct: num(quote.changePercentage),
    volume: num(quote.volume),
    avg_volume: num(quote.averageVolume),
    fifty_two_week_high: num(quote.yearHigh),
    fifty_two_week_low: num(quote.yearLow),
    fifty_day_avg: num(quote.priceAvg50),
    two_hundred_day_avg: num(quote.priceAvg200),
    beta: num(profile?.beta),
    dividend_rate: num(profile?.lastDividend),
    sector: str(profile?.sector),
    industry: str(profile?.industry),
    exchange: str(profile?.exchangeFullName) ?? str(quote.exchange),
  };
}

async function fetchFmpQuote(ticker: string): Promise<FmpQuote> {
  const url = withFmpKey(`/quote?symbol=${encodeURIComponent(ticker)}`);
  const rows = await fetchJson<FmpQuote[] | { "Error Message"?: string }>(url);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No quote rows returned for ${ticker}`);
  }
  return rows[0];
}

async function fetchFmpProfile(ticker: string): Promise<FmpProfile | null> {
  const url = withFmpKey(`/profile?symbol=${encodeURIComponent(ticker)}`);
  try {
    const rows = await fetchJson<FmpProfile[] | { "Error Message"?: string }>(url);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch {
    return null;
  }
}

async function fetchFmpHistory(
  ticker: string,
): Promise<{ date: string; close: number }[]> {
  const from = yearsAgoISO(5).toISOString().slice(0, 10);
  const url = withFmpKey(
    `/historical-price-eod/light?symbol=${encodeURIComponent(ticker)}&from=${from}`,
  );
  const rows = await fetchJson<FmpHistoryPoint[] | { "Error Message"?: string }>(url);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((point) => ({
      date: dateOnly(point.date),
      close: num(point.price),
    }))
    .filter(
      (point): point is { date: string; close: number } =>
        point.date != null && point.close != null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function refreshViaFmp(ticker: string): Promise<PriceEntry> {
  if (!FMP_API_KEY) {
    throw new Error(
      "FMP_API_KEY is not set. Provide FMP_API_KEY to use Financial Modeling Prep.",
    );
  }

  const profile = await fetchFmpProfile(ticker);
  let quote: FmpQuote | null = null;
  try {
    quote = await fetchFmpQuote(ticker);
  } catch (err) {
    if (!(err instanceof FmpUnsupportedSymbolError)) {
      throw err;
    }
    if (profile == null) {
      throw new FmpUnsupportedSymbolError(ticker, err.message);
    }
  }

  let history: { date: string; close: number }[] = [];
  try {
    history = await fetchFmpHistory(ticker);
  } catch (err) {
    if (!(err instanceof FmpUnsupportedSymbolError)) {
      throw err;
    }
  }

  const quoteLike = (quote ?? profile) as FmpQuote | null;
  if (quoteLike == null) {
    throw new Error(`No quote/profile rows returned for ${ticker}`);
  }

  const price = num(quoteLike.price);
  const currency = str(quoteLike.currency) ?? inferCurrency(ticker);
  const ytdPct = calculateYtdPct(price, history);
  const metrics = buildFmpMetrics(quoteLike, profile);

  return {
    price,
    market_cap: num(quoteLike.marketCap),
    currency,
    ytd_pct: ytdPct,
    history,
    updated_at: new Date().toISOString().slice(0, 10),
    metrics,
  };
}

async function refreshOne(ticker: string): Promise<PriceEntry> {
  return refreshViaFmp(ticker);
}

async function refreshPerson(slug: string, tickerFilter?: string) {
  const dir = path.join(PEOPLE_DIR, slug);
  const picksPath = path.join(dir, "picks.json");
  const pricesPath = path.join(dir, "prices.json");

  if (!fs.existsSync(picksPath)) {
    console.warn(`[refresh] ${slug}: no picks.json at ${picksPath}, skipping`);
    return { ok: 0, fail: 0, fmp: 0 };
  }

  const picks = PicksFileSchema.parse(
    JSON.parse(fs.readFileSync(picksPath, "utf8")),
  );
  const tickers = Array.from(new Set(picks.map((p) => p.ticker))).sort();
  const targets = tickerFilter
    ? tickers.filter((t) => t === tickerFilter)
    : tickers;

  if (targets.length === 0) {
    console.log(`[refresh] ${slug}: no tickers to process`);
    return { ok: 0, fail: 0, fmp: 0 };
  }

  let existing: Record<string, PriceEntry> = {};
  if (fs.existsSync(pricesPath)) {
    try {
      existing = PricesFileSchema.parse(
        JSON.parse(fs.readFileSync(pricesPath, "utf8")),
      );
    } catch {
      console.warn(`[refresh] ${slug}: existing prices.json invalid, starting fresh`);
    }
  }

  const out: Record<string, PriceEntry> = { ...existing };
  let ok = 0;
  let fail = 0;
  let fmp = 0;

  console.log(`\n[refresh] ${slug}: ${targets.length} ticker(s)`);
  for (const ticker of targets) {
    process.stdout.write(`  - ${ticker.padEnd(12)} `);
    try {
      const entry = await refreshOne(ticker);
      const prev = out[ticker];
      if (entry.history.length === 0 && prev?.history?.length) {
        entry.history = prev.history;
      }
      if (
        entry.history.length === 0 &&
        entry.ytd_pct === 0 &&
        prev != null &&
        prev.ytd_pct !== 0
      ) {
        entry.ytd_pct = prev.ytd_pct;
      }
      out[ticker] = entry;
      ok++;
      fmp++;
      const ytd = entry.ytd_pct >= 0 ? `+${entry.ytd_pct}%` : `${entry.ytd_pct}%`;
      const day =
        entry.metrics?.day_change_pct != null
          ? ` day=${entry.metrics.day_change_pct >= 0 ? "+" : ""}${entry.metrics.day_change_pct.toFixed(2)}%`
          : "";
      console.log(
        `${entry.price ?? "—"} ${entry.currency}  ytd=${ytd}${day}  hist=${entry.history.length}d [fmp]`,
      );
    } catch (err) {
      fail++;
      console.log(`FAILED: ${(err as Error).message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  PricesFileSchema.parse(out);
  fs.writeFileSync(pricesPath, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `[refresh] ${slug}: ok=${ok} fail=${fail} fmp=${fmp}  ->  ${path.relative(ROOT, pricesPath)}`,
  );
  return { ok, fail, fmp };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const people = PeopleFileSchema.parse(
    JSON.parse(fs.readFileSync(PEOPLE_FILE, "utf8")),
  ).filter((p) => p.active !== false);
  const targetPeople = args.person
    ? people.filter((p) => p.slug === args.person)
    : people;

  if (targetPeople.length === 0) {
    console.log(`[refresh] no people to process (filter: ${args.person ?? "<all>"})`);
    return;
  }

  let totalOk = 0;
  let totalFail = 0;
  let totalFmp = 0;
  for (const person of targetPeople) {
    const { ok, fail, fmp } = await refreshPerson(person.slug, args.ticker);
    totalOk += ok;
    totalFail += fail;
    totalFmp += fmp;
  }

  console.log(`\n[refresh] DONE ok=${totalOk} fail=${totalFail} fmp=${totalFmp}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
