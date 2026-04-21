/**
 * Refresh price/marketcap/YTD/history + fundamentals for every ticker
 * in data/people/<person>/picks.json.
 *
 *   pnpm refresh                          # refresh all people in data/people.json
 *   pnpm refresh -- --person serenity     # only one person
 *   pnpm refresh -- --ticker IQE.L        # only one ticker (across all people)
 *
 * Uses FMP stable endpoints as the primary provider, with automatic Yahoo
 * fallback for symbols unavailable on the current FMP subscription.
 */
import fs from "node:fs";
import path from "node:path";
import yahooFinance from "yahoo-finance2";
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

type RefreshSource = "fmp" | "yahoo";

class FmpUnsupportedSymbolError extends Error {
  constructor(ticker: string, detail: string) {
    super(`FMP unsupported symbol ${ticker}: ${detail}`);
    this.name = "FmpUnsupportedSymbolError";
  }
}

// Quiet down yahoo-finance2's deprecation/notice prints. The API has moved
// around between minor versions, so we feature-detect both names.
const yf = yahooFinance as unknown as {
  suppressNotices?: (keys: string[]) => void;
  setGlobalConfig?: (cfg: Record<string, unknown>) => void;
};
if (typeof yf.suppressNotices === "function") {
  yf.suppressNotices(["yahooSurvey", "ripHistorical"]);
} else if (typeof yf.setGlobalConfig === "function") {
  yf.setGlobalConfig({ notifyRipHistorical: false });
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
  // yahoo-finance2 sometimes returns { raw, fmt } shapes
  if (typeof v === "object" && v !== null && "raw" in v) {
    const raw = (v as { raw: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function pctFromDecimal(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  return Number((n * 100).toFixed(2));
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

  let quote: FmpQuote;
  try {
    quote = await fetchFmpQuote(ticker);
  } catch (err) {
    if (err instanceof FmpUnsupportedSymbolError) {
      throw new FmpUnsupportedSymbolError(ticker, err.message);
    }
    throw err;
  }
  const [history, profile] = await Promise.all([
    fetchFmpHistory(ticker),
    fetchFmpProfile(ticker),
  ]);

  const price = num(quote.price);
  const currency = str(quote.currency) ?? inferCurrency(ticker);
  const ytdPct = calculateYtdPct(price, history);
  const metrics = buildFmpMetrics(quote, profile);

  return {
    price,
    market_cap: num(quote.marketCap),
    currency,
    ytd_pct: ytdPct,
    history,
    updated_at: new Date().toISOString().slice(0, 10),
    metrics,
  };
}

async function fetchYahooSummary(
  ticker: string,
): Promise<Record<string, unknown> | null> {
  try {
    return (await yahooFinance.quoteSummary(ticker, {
      modules: [
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "calendarEvents",
        "summaryProfile",
        "price",
      ],
    })) as Record<string, unknown>;
  } catch (err) {
    console.warn(`  ! quoteSummary failed for ${ticker}:`, (err as Error).message);
    return null;
  }
}

function buildYahooMetrics(
  quote: Record<string, unknown>,
  summary: Record<string, unknown> | null,
): FinancialMetrics {
  const sd = (summary?.summaryDetail ?? {}) as Record<string, unknown>;
  const dks = (summary?.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (summary?.financialData ?? {}) as Record<string, unknown>;
  const ce = (summary?.calendarEvents ?? {}) as Record<string, unknown>;
  const sp = (summary?.summaryProfile ?? {}) as Record<string, unknown>;
  const pr = (summary?.price ?? {}) as Record<string, unknown>;
  const earnings = (ce.earnings ?? {}) as Record<string, unknown>;
  const earningsDates = Array.isArray(earnings.earningsDate)
    ? (earnings.earningsDate as unknown[])
    : [];
  const nextEarnings =
    earningsDates.length > 0 ? dateOnly(earningsDates[0]) : null;

  return {
    prev_close: num(quote.regularMarketPreviousClose) ?? num(sd.previousClose),
    open: num(quote.regularMarketOpen) ?? num(sd.open),
    day_high: num(quote.regularMarketDayHigh) ?? num(sd.dayHigh),
    day_low: num(quote.regularMarketDayLow) ?? num(sd.dayLow),
    day_change_pct: num(quote.regularMarketChangePercent),
    volume: num(quote.regularMarketVolume) ?? num(sd.volume),
    avg_volume:
      num(quote.averageDailyVolume3Month) ??
      num(sd.averageVolume) ??
      num(sd.averageDailyVolume10Day),
    fifty_two_week_high:
      num(quote.fiftyTwoWeekHigh) ?? num(sd.fiftyTwoWeekHigh),
    fifty_two_week_low:
      num(quote.fiftyTwoWeekLow) ?? num(sd.fiftyTwoWeekLow),
    fifty_two_week_change_pct:
      num(quote.fiftyTwoWeekChangePercent) ?? pctFromDecimal(dks["52WeekChange"]),
    fifty_day_avg: num(quote.fiftyDayAverage) ?? num(sd.fiftyDayAverage),
    two_hundred_day_avg:
      num(quote.twoHundredDayAverage) ?? num(sd.twoHundredDayAverage),
    pe_trailing: num(quote.trailingPE) ?? num(sd.trailingPE),
    pe_forward: num(quote.forwardPE) ?? num(sd.forwardPE) ?? num(dks.forwardPE),
    peg_ratio: num(dks.pegRatio),
    price_to_book: num(quote.priceToBook) ?? num(dks.priceToBook),
    price_to_sales: num(sd.priceToSalesTrailing12Months),
    ev_to_revenue: num(dks.enterpriseToRevenue),
    ev_to_ebitda: num(dks.enterpriseToEbitda),
    enterprise_value: num(dks.enterpriseValue),
    eps_trailing:
      num(quote.epsTrailingTwelveMonths) ?? num(dks.trailingEps),
    eps_forward: num(quote.epsForward) ?? num(dks.forwardEps),
    shares_outstanding:
      num(quote.sharesOutstanding) ?? num(dks.sharesOutstanding),
    float_shares: num(dks.floatShares),
    total_revenue: num(fd.totalRevenue),
    revenue_growth: pctFromDecimal(fd.revenueGrowth),
    earnings_growth: pctFromDecimal(fd.earningsGrowth),
    gross_margin: pctFromDecimal(fd.grossMargins),
    operating_margin: pctFromDecimal(fd.operatingMargins),
    profit_margin: pctFromDecimal(fd.profitMargins) ?? pctFromDecimal(dks.profitMargins),
    ebitda_margin: pctFromDecimal(fd.ebitdaMargins),
    return_on_equity: pctFromDecimal(fd.returnOnEquity),
    return_on_assets: pctFromDecimal(fd.returnOnAssets),
    total_cash: num(fd.totalCash),
    total_debt: num(fd.totalDebt),
    debt_to_equity: num(fd.debtToEquity),
    current_ratio: num(fd.currentRatio),
    quick_ratio: num(fd.quickRatio),
    free_cashflow: num(fd.freeCashflow),
    operating_cashflow: num(fd.operatingCashflow),
    recommendation_key: str(fd.recommendationKey),
    recommendation_mean: num(fd.recommendationMean),
    num_analysts: num(fd.numberOfAnalystOpinions),
    target_mean_price: num(fd.targetMeanPrice),
    target_high_price: num(fd.targetHighPrice),
    target_low_price: num(fd.targetLowPrice),
    beta: num(quote.beta) ?? num(sd.beta) ?? num(dks.beta),
    short_pct_float: pctFromDecimal(dks.shortPercentOfFloat),
    short_ratio: num(dks.shortRatio),
    dividend_yield:
      pctFromDecimal(sd.dividendYield) ??
      (typeof quote.dividendYield === "number"
        ? Number((quote.dividendYield as number).toFixed(2))
        : null),
    dividend_rate: num(sd.dividendRate) ?? num(quote.dividendRate),
    payout_ratio: pctFromDecimal(sd.payoutRatio),
    ex_dividend_date: dateOnly(sd.exDividendDate ?? quote.dividendDate),
    next_earnings_date: nextEarnings,
    sector: str(sp.sector),
    industry: str(sp.industry),
    exchange: str(pr.exchangeName) ?? str(quote.fullExchangeName),
  };
}

async function refreshViaYahoo(ticker: string): Promise<PriceEntry> {
  const quote = (await yahooFinance.quote(ticker)) as Record<string, unknown>;
  const currency = str(quote.currency) ?? inferCurrency(ticker);
  const price = num(quote.regularMarketPrice);
  const marketCap = num(quote.marketCap);

  let history: { date: string; close: number }[] = [];
  try {
    const chart = await yahooFinance.chart(ticker, {
      period1: yearsAgoISO(5),
      interval: "1d",
    });
    const quotes = chart.quotes ?? [];
    history = quotes
      .filter((q) => typeof q.close === "number" && q.date instanceof Date)
      .map((q) => ({
        date: (q.date as Date).toISOString().slice(0, 10),
        close: q.close as number,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn(`  ! chart failed for ${ticker}:`, (err as Error).message);
  }

  const summary = await fetchYahooSummary(ticker);
  const metrics = buildYahooMetrics(quote, summary);
  const ytdPct = calculateYtdPct(price, history);

  return {
    price,
    market_cap: marketCap,
    currency,
    ytd_pct: ytdPct,
    history,
    updated_at: new Date().toISOString().slice(0, 10),
    metrics,
  };
}

async function refreshOne(
  ticker: string,
): Promise<{ entry: PriceEntry; source: RefreshSource }> {
  try {
    const entry = await refreshViaFmp(ticker);
    return { entry, source: "fmp" };
  } catch (err) {
    const message = (err as Error).message;
    const shouldFallback =
      err instanceof FmpUnsupportedSymbolError ||
      message.includes("FMP unsupported symbol") ||
      message.includes("Special Endpoint");
    if (!shouldFallback) throw err;
    const entry = await refreshViaYahoo(ticker);
    return { entry, source: "yahoo" };
  }
}

async function refreshPerson(slug: string, tickerFilter?: string) {
  const dir = path.join(PEOPLE_DIR, slug);
  const picksPath = path.join(dir, "picks.json");
  const pricesPath = path.join(dir, "prices.json");

  if (!fs.existsSync(picksPath)) {
    console.warn(`[refresh] ${slug}: no picks.json at ${picksPath}, skipping`);
    return { ok: 0, fail: 0, fmp: 0, yahoo: 0 };
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
    return { ok: 0, fail: 0, fmp: 0, yahoo: 0 };
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
  let yahoo = 0;

  console.log(`\n[refresh] ${slug}: ${targets.length} ticker(s)`);
  for (const ticker of targets) {
    process.stdout.write(`  - ${ticker.padEnd(12)} `);
    try {
      const { entry, source } = await refreshOne(ticker);
      out[ticker] = entry;
      ok++;
      if (source === "fmp") fmp++;
      else yahoo++;
      const ytd = entry.ytd_pct >= 0 ? `+${entry.ytd_pct}%` : `${entry.ytd_pct}%`;
      const day =
        entry.metrics?.day_change_pct != null
          ? ` day=${entry.metrics.day_change_pct >= 0 ? "+" : ""}${entry.metrics.day_change_pct.toFixed(2)}%`
          : "";
      console.log(
        `${entry.price ?? "—"} ${entry.currency}  ytd=${ytd}${day}  hist=${entry.history.length}d [${source}]`,
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
    `[refresh] ${slug}: ok=${ok} fail=${fail} fmp=${fmp} yahoo=${yahoo}  ->  ${path.relative(ROOT, pricesPath)}`,
  );
  return { ok, fail, fmp, yahoo };
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
  let totalYahoo = 0;
  for (const person of targetPeople) {
    const { ok, fail, fmp, yahoo } = await refreshPerson(person.slug, args.ticker);
    totalOk += ok;
    totalFail += fail;
    totalFmp += fmp;
    totalYahoo += yahoo;
  }

  console.log(
    `\n[refresh] DONE ok=${totalOk} fail=${totalFail} fmp=${totalFmp} yahoo=${totalYahoo}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
