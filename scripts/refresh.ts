/**
 * Refresh price/marketcap/YTD/history + rich fundamentals for every ticker
 * in the Supabase `picks` table.
 *
 *   npm run refresh                          # refresh all active people
 *   npm run refresh -- --person serenity     # only one person
 *   npm run refresh -- --ticker IQE.L        # only one ticker (across all people)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import yahooFinance from "yahoo-finance2";
import {
  FinancialMetricsSchema,
  PriceEntrySchema,
  type FinancialMetrics,
  type PriceEntry,
} from "../lib/schema";

const yf = yahooFinance as unknown as {
  suppressNotices?: (keys: string[]) => void;
  setGlobalConfig?: (cfg: Record<string, unknown>) => void;
};
if (typeof yf.suppressNotices === "function") {
  yf.suppressNotices(["yahooSurvey", "ripHistorical"]);
} else if (typeof yf.setGlobalConfig === "function") {
  yf.setGlobalConfig({ notifyRipHistorical: false });
}

const RATE_LIMIT_MS = 250;
const DEFAULT_CURRENCY: Record<string, string> = {
  ".L": "GBp",
  ".ST": "SEK",
  ".PA": "EUR",
  ".HK": "HKD",
  ".TO": "CAD",
};

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function getSupabase(): SupabaseClient {
  const url = getEnv("SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SUPABASE_SERVICE_KEY") ??
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    getEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) env var. Put it in .env.",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (preferred for writes) or SUPABASE_ANON_KEY env var. Put it in .env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadDotEnv() {
  try {
    // Best-effort: read .env and populate process.env without adding a dep.
    // Only overrides values that are not already set.
    const fs = require("node:fs");
    const path = require("node:path");
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8") as string;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // ignore
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
  if (typeof v === "object" && v !== null && "raw" in v) {
    const raw = (v as { raw: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function pct(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  return Number((n * 100).toFixed(2));
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

async function fetchSummary(ticker: string): Promise<Record<string, unknown> | null> {
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

function buildMetrics(
  quote: Record<string, unknown>,
  summary: Record<string, unknown> | null,
): FinancialMetrics {
  const sd = (summary?.summaryDetail ?? {}) as Record<string, unknown>;
  const dks = (summary?.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (summary?.financialData ?? {}) as Record<string, unknown>;
  const ce = (summary?.calendarEvents ?? {}) as Record<string, unknown>;
  const sp = (summary?.summaryProfile ?? {}) as Record<string, unknown>;
  const pr = (summary?.price ?? {}) as Record<string, unknown>;

  const earnings = (ce?.earnings ?? {}) as Record<string, unknown>;
  const earningsDates = Array.isArray(earnings.earningsDate)
    ? (earnings.earningsDate as unknown[])
    : [];
  const nextEarnings =
    earningsDates.length > 0 ? dateOnly(earningsDates[0]) : null;

  return FinancialMetricsSchema.parse({
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
      num(quote.fiftyTwoWeekChangePercent) ?? pct(dks["52WeekChange"]),

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
    revenue_growth: pct(fd.revenueGrowth),
    earnings_growth: pct(fd.earningsGrowth),
    gross_margin: pct(fd.grossMargins),
    operating_margin: pct(fd.operatingMargins),
    profit_margin: pct(fd.profitMargins) ?? pct(dks.profitMargins),
    ebitda_margin: pct(fd.ebitdaMargins),
    return_on_equity: pct(fd.returnOnEquity),
    return_on_assets: pct(fd.returnOnAssets),

    total_cash: num(fd.totalCash),
    total_debt: num(fd.totalDebt),
    debt_to_equity: num(fd.debtToEquity),
    current_ratio: num(fd.currentRatio),
    quick_ratio: num(fd.quickRatio),
    free_cashflow: num(fd.freeCashflow),
    operating_cashflow: num(fd.operatingCashflow),

    recommendation_key:
      (typeof fd.recommendationKey === "string"
        ? (fd.recommendationKey as string)
        : null) ?? null,
    recommendation_mean: num(fd.recommendationMean),
    num_analysts: num(fd.numberOfAnalystOpinions),
    target_mean_price: num(fd.targetMeanPrice),
    target_high_price: num(fd.targetHighPrice),
    target_low_price: num(fd.targetLowPrice),

    beta: num(quote.beta) ?? num(sd.beta) ?? num(dks.beta),
    short_pct_float: pct(dks.shortPercentOfFloat),
    short_ratio: num(dks.shortRatio),
    dividend_yield:
      pct(sd.dividendYield) ??
      (typeof quote.dividendYield === "number"
        ? Number((quote.dividendYield as number).toFixed(2))
        : null),
    dividend_rate: num(sd.dividendRate) ?? num(quote.dividendRate),
    payout_ratio: pct(sd.payoutRatio),
    ex_dividend_date: dateOnly(sd.exDividendDate ?? quote.dividendDate),
    next_earnings_date: nextEarnings,

    sector: (typeof sp.sector === "string" ? (sp.sector as string) : null) ?? null,
    industry:
      (typeof sp.industry === "string" ? (sp.industry as string) : null) ?? null,
    exchange:
      (typeof pr.exchangeName === "string"
        ? (pr.exchangeName as string)
        : typeof quote.fullExchangeName === "string"
          ? (quote.fullExchangeName as string)
          : null) ?? null,
  });
}

async function refreshOne(ticker: string): Promise<PriceEntry> {
  const quote = (await yahooFinance.quote(ticker)) as Record<string, unknown>;
  const currency =
    (typeof quote.currency === "string" ? (quote.currency as string) : null) ??
    inferCurrency(ticker);
  const price = num(quote.regularMarketPrice);
  const marketCap = num(quote.marketCap);

  let ytdPct = 0;
  let history: { date: string; close: number }[] = [];
  const jan1Ms = jan1ISO().getTime();

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
      }));
    if (history.length > 1 && price != null) {
      const ytdStart =
        history.find((point) => {
          const ms = Date.parse(point.date);
          return !Number.isNaN(ms) && ms >= jan1Ms;
        }) ?? history[history.length - 1];
      const start = ytdStart.close;
      if (start && start > 0) {
        ytdPct = ((price - start) / start) * 100;
      }
    }
  } catch (err) {
    console.warn(`  ! chart failed for ${ticker}:`, (err as Error).message);
  }

  const summary = await fetchSummary(ticker);
  const metrics = buildMetrics(quote, summary);

  return PriceEntrySchema.parse({
    price,
    market_cap: marketCap,
    currency,
    ytd_pct: Number(ytdPct.toFixed(2)),
    history,
    updated_at: new Date().toISOString().slice(0, 10),
    metrics,
  });
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function refreshPerson(
  client: SupabaseClient,
  slug: string,
  tickerFilter?: string,
) {
  const { data: picks, error } = await client
    .from("picks")
    .select("ticker")
    .eq("person_slug", slug);
  if (error) {
    console.warn(`[refresh] ${slug}: failed to load picks: ${error.message}`);
    return { ok: 0, fail: 0 };
  }

  const tickers = Array.from(
    new Set((picks ?? []).map((p: { ticker: string }) => p.ticker)),
  ).sort();
  const targets = tickerFilter
    ? tickers.filter((t) => t === tickerFilter)
    : tickers;

  if (targets.length === 0) {
    console.log(`[refresh] ${slug}: no tickers to process`);
    return { ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;

  console.log(`\n[refresh] ${slug}: ${targets.length} ticker(s)`);
  for (const ticker of targets) {
    process.stdout.write(`  - ${ticker.padEnd(12)} `);
    try {
      const entry = await refreshOne(ticker);
      const { error: upsertErr } = await client.from("prices").upsert(
        {
          person_slug: slug,
          ticker,
          price: entry.price,
          market_cap: entry.market_cap,
          currency: entry.currency,
          ytd_pct: entry.ytd_pct,
          history: entry.history,
          metrics: entry.metrics ?? {},
          updated_at: entry.updated_at,
        },
        { onConflict: "person_slug,ticker" },
      );
      if (upsertErr) {
        fail++;
        console.log(`FAILED (upsert): ${upsertErr.message}`);
      } else {
        ok++;
        const ytd =
          entry.ytd_pct >= 0 ? `+${entry.ytd_pct}%` : `${entry.ytd_pct}%`;
        const day =
          entry.metrics?.day_change_pct != null
            ? ` day=${entry.metrics.day_change_pct >= 0 ? "+" : ""}${entry.metrics.day_change_pct.toFixed(2)}%`
            : "";
        console.log(
          `${entry.price ?? "—"} ${entry.currency}  ytd=${ytd}${day}  hist=${entry.history.length}d`,
        );
      }
    } catch (err) {
      fail++;
      console.log(`FAILED: ${(err as Error).message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`[refresh] ${slug}: ok=${ok} fail=${fail}`);
  return { ok, fail };
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const client = getSupabase();

  const { data: people, error } = await client
    .from("people")
    .select("slug")
    .eq("active", true);
  if (error) {
    throw new Error(`[refresh] failed to list people: ${error.message}`);
  }

  const targetPeople = (people ?? [])
    .map((p: { slug: string }) => p.slug)
    .filter((s: string) => !args.person || s === args.person);

  if (targetPeople.length === 0) {
    console.log(
      `[refresh] no people to process (filter: ${args.person ?? "<all>"})`,
    );
    return;
  }

  let totalOk = 0;
  let totalFail = 0;
  for (const slug of targetPeople) {
    const { ok, fail } = await refreshPerson(client, slug, args.ticker);
    totalOk += ok;
    totalFail += fail;
  }

  console.log(`\n[refresh] DONE ok=${totalOk} fail=${totalFail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
