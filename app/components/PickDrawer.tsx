"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { EnrichedPick } from "@/lib/data";
import type { Theme } from "@/lib/schema";
import {
  formatDate,
  formatLargeNumber,
  formatPct,
  formatPctNullable,
  formatPrice,
  formatRatio,
  formatVolume,
  recommendationLabel,
  recommendationTone,
} from "@/lib/format";

const Sparkline = dynamic(() => import("./Sparkline").then((m) => m.Sparkline), {
  ssr: false,
});

type TweetMarker = {
  tweet_id: string;
  tweet_url: string;
  tweeted_at: string;
};

export function PickDrawer({
  pick,
  theme,
  personSlug,
  onClose,
}: {
  pick: EnrichedPick | null;
  theme: Theme | null;
  personSlug: string;
  onClose: () => void;
}) {
  const [resolvedPick, setResolvedPick] = useState<EnrichedPick | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [pick, onClose]);

  useEffect(() => {
    let cancelled = false;
    if (!pick) {
      setResolvedPick(null);
      setIsLoadingHistory(false);
      return;
    }

    setResolvedPick(pick);
    setIsLoadingHistory(true);

    void fetch(
      `/api/person/${encodeURIComponent(personSlug)}/pick/${encodeURIComponent(pick.ticker)}`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as EnrichedPick | null;
      })
      .then((fullPick) => {
        if (cancelled || !fullPick) return;
        setResolvedPick(fullPick);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pick, personSlug]);

  if (!pick) return null;
  const activePick = resolvedPick ?? pick;

  const tweetMarkers: TweetMarker[] =
    activePick.tweet_events && activePick.tweet_events.length > 0
      ? activePick.tweet_events.map((event) => ({
          tweet_id: event.tweet_id,
          tweet_url: event.tweet_url,
          tweeted_at: event.tweeted_at,
        }))
      : activePick.first_mentioned_at
        ? [
            {
              tweet_id: activePick.tweet_id,
              tweet_url: activePick.tweet_url,
              tweeted_at: activePick.first_mentioned_at,
            },
          ]
        : [];

  const m = activePick.metrics ?? {};
  const ytdTone =
    activePick.ytd_pct >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
  const dayTone =
    m.day_change_pct == null
      ? "text-[var(--color-text-dim)]"
      : m.day_change_pct >= 0
        ? "text-[var(--color-up)]"
        : "text-[var(--color-down)]";

  // Upside vs analyst mean target
  const upsidePct =
    activePick.price != null && m.target_mean_price != null && activePick.price > 0
      ? ((m.target_mean_price - activePick.price) / activePick.price) * 100
      : null;

  const recTone = recommendationTone(m.recommendation_key);
  const recColor =
    recTone === "up"
      ? "text-[var(--color-up)]"
      : recTone === "down"
        ? "text-[var(--color-down)]"
        : "text-[var(--color-text-dim)]";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <aside
        className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] shadow-2xl"
        style={{
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          className="border-b border-[var(--color-border)] px-6 py-5"
          style={
            theme
              ? { boxShadow: `inset 0 1px 0 ${theme.accent}` }
              : undefined
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                {m.exchange ?? "Pick Detail"}
                {m.sector && (
                  <span className="text-[var(--color-text-muted)]">
                    {" · "}
                    {m.sector}
                  </span>
                )}
              </p>
              <h2 className="mt-2 font-mono text-3xl font-semibold text-white">
                {activePick.ticker}
              </h2>
              <p className="truncate text-sm text-[var(--color-text-dim)]">
                {activePick.name}
              </p>
              {m.industry && (
                <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {m.industry}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-[var(--color-border-strong)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            >
              Close
            </button>
          </div>
        </div>

        {/* Top stats: price / day / YTD / mkt cap */}
        <div className="grid grid-cols-2 gap-px border-b border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
          <Stat label="Price" value={formatPrice(activePick.price, activePick.currency)} />
          <Stat
            label="Day"
            value={formatPctNullable(m.day_change_pct, { sign: true })}
            tone={dayTone}
          />
          <Stat
            label="YTD"
            value={formatPct(activePick.ytd_pct, { sign: true })}
            tone={ytdTone}
          />
          <Stat
            label="Mkt Cap"
            value={formatLargeNumber(activePick.market_cap, { currency: "USD" })}
          />
        </div>

        {/* Price history chart */}
        <Section title="Price History">
          <div className="mt-3 h-40">
            {activePick.history.length > 1 ? (
              <Sparkline
                data={activePick.history}
                positive={activePick.ytd_pct >= 0}
                tweetMarkers={tweetMarkers}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-sm border border-dashed border-[var(--color-border-strong)] px-4 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  {isLoadingHistory
                    ? "Loading full history…"
                    : "Historical candles unavailable"}
                </p>
                <p className="mt-1 font-mono text-lg text-white">
                  Spot {formatPrice(activePick.price, activePick.currency)}
                </p>
                {m.day_change_pct != null && (
                  <p
                    className={`mt-1 font-mono text-xs ${
                      m.day_change_pct >= 0
                        ? "text-[var(--color-up)]"
                        : "text-[var(--color-down)]"
                    }`}
                  >
                    Day {formatPctNullable(m.day_change_pct, { sign: true })}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                  {isLoadingHistory
                    ? "Fetching the latest candle data for this ticker."
                    : "Run "}
                  {!isLoadingHistory && (
                    <>
                      <code className="text-[var(--color-gold)]">npm run refresh</code>{" "}
                      after plan upgrade to load full history.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
          {activePick.updated_at && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Updated {activePick.updated_at}
            </p>
          )}
        </Section>

        {/* Today's session */}
        <Section title="Today">
          <Grid cols={3}>
            <MiniStat
              label="Open"
              value={formatPrice(m.open ?? null, activePick.currency)}
            />
            <MiniStat
              label="Day High"
              value={formatPrice(m.day_high ?? null, activePick.currency)}
            />
            <MiniStat
              label="Day Low"
              value={formatPrice(m.day_low ?? null, activePick.currency)}
            />
            <MiniStat
              label="Prev Close"
              value={formatPrice(m.prev_close ?? null, activePick.currency)}
            />
            <MiniStat label="Volume" value={formatVolume(m.volume)} />
            <MiniStat label="Avg Vol" value={formatVolume(m.avg_volume)} />
          </Grid>
        </Section>

        {/* 52-Week range */}
        <Section title="52-Week Range">
          <RangeBar
            current={activePick.price}
            low={m.fifty_two_week_low ?? null}
            high={m.fifty_two_week_high ?? null}
            currency={activePick.currency}
          />
          <Grid cols={3} className="mt-4">
            <MiniStat
              label="52W Low"
              value={formatPrice(m.fifty_two_week_low ?? null, activePick.currency)}
            />
            <MiniStat
              label="52W High"
              value={formatPrice(m.fifty_two_week_high ?? null, activePick.currency)}
            />
            <MiniStat
              label="52W Change"
              value={formatPctNullable(m.fifty_two_week_change_pct, { sign: true })}
              tone={
                m.fifty_two_week_change_pct == null
                  ? undefined
                  : m.fifty_two_week_change_pct >= 0
                    ? "text-[var(--color-up)]"
                    : "text-[var(--color-down)]"
              }
            />
            <MiniStat
              label="50D Avg"
              value={formatPrice(m.fifty_day_avg ?? null, activePick.currency)}
            />
            <MiniStat
              label="200D Avg"
              value={formatPrice(m.two_hundred_day_avg ?? null, activePick.currency)}
            />
            <MiniStat
              label="Beta"
              value={formatRatio(m.beta, { digits: 2 })}
            />
          </Grid>
        </Section>

        {/* Valuation */}
        <Section title="Valuation">
          <Grid cols={3}>
            <MiniStat label="P/E (TTM)" value={formatRatio(m.pe_trailing)} />
            <MiniStat label="Fwd P/E" value={formatRatio(m.pe_forward)} />
            <MiniStat label="PEG" value={formatRatio(m.peg_ratio)} />
            <MiniStat label="P/B" value={formatRatio(m.price_to_book)} />
            <MiniStat label="P/S" value={formatRatio(m.price_to_sales)} />
            <MiniStat
              label="EV"
              value={formatLargeNumber(m.enterprise_value, { currency: "USD" })}
            />
            <MiniStat label="EV / Rev" value={formatRatio(m.ev_to_revenue)} />
            <MiniStat label="EV / EBITDA" value={formatRatio(m.ev_to_ebitda)} />
            <MiniStat label="EPS (TTM)" value={formatRatio(m.eps_trailing)} />
          </Grid>
        </Section>

        {/* Profitability & Growth */}
        <Section title="Profitability & Growth">
          <Grid cols={3}>
            <MiniStat
              label="Revenue (TTM)"
              value={formatLargeNumber(m.total_revenue, { currency: "USD" })}
            />
            <MiniStat
              label="Rev Growth"
              value={formatPctNullable(m.revenue_growth, { sign: true })}
              tone={tonePct(m.revenue_growth)}
            />
            <MiniStat
              label="EPS Growth"
              value={formatPctNullable(m.earnings_growth, { sign: true })}
              tone={tonePct(m.earnings_growth)}
            />
            <MiniStat
              label="Gross Margin"
              value={formatPctNullable(m.gross_margin)}
            />
            <MiniStat
              label="Operating Margin"
              value={formatPctNullable(m.operating_margin)}
            />
            <MiniStat
              label="Profit Margin"
              value={formatPctNullable(m.profit_margin)}
            />
            <MiniStat
              label="EBITDA Margin"
              value={formatPctNullable(m.ebitda_margin)}
            />
            <MiniStat
              label="ROE"
              value={formatPctNullable(m.return_on_equity)}
            />
            <MiniStat
              label="ROA"
              value={formatPctNullable(m.return_on_assets)}
            />
          </Grid>
        </Section>

        {/* Balance Sheet & Cash */}
        <Section title="Balance Sheet & Cash Flow">
          <Grid cols={3}>
            <MiniStat
              label="Cash"
              value={formatLargeNumber(m.total_cash, { currency: "USD" })}
            />
            <MiniStat
              label="Debt"
              value={formatLargeNumber(m.total_debt, { currency: "USD" })}
            />
            <MiniStat
              label="Debt / Equity"
              value={formatRatio(m.debt_to_equity)}
            />
            <MiniStat
              label="Current Ratio"
              value={formatRatio(m.current_ratio)}
            />
            <MiniStat
              label="Quick Ratio"
              value={formatRatio(m.quick_ratio)}
            />
            <MiniStat
              label="Free Cash Flow"
              value={formatLargeNumber(m.free_cashflow, { currency: "USD" })}
            />
            <MiniStat
              label="Op. Cash Flow"
              value={formatLargeNumber(m.operating_cashflow, { currency: "USD" })}
            />
            <MiniStat
              label="Shares Out"
              value={formatLargeNumber(m.shares_outstanding)}
            />
            <MiniStat
              label="Float"
              value={formatLargeNumber(m.float_shares)}
            />
          </Grid>
        </Section>

        {/* Analyst Coverage */}
        <Section title="Analyst Coverage">
          <Grid cols={3}>
            <MiniStat
              label="Recommendation"
              value={recommendationLabel(m.recommendation_key)}
              tone={recColor}
            />
            <MiniStat
              label="Score"
              value={formatRatio(m.recommendation_mean, { digits: 2 })}
            />
            <MiniStat
              label="Analysts"
              value={
                m.num_analysts != null ? `${m.num_analysts}` : "—"
              }
            />
            <MiniStat
              label="Target Low"
              value={formatPrice(m.target_low_price ?? null, activePick.currency)}
            />
            <MiniStat
              label="Target Mean"
              value={formatPrice(m.target_mean_price ?? null, activePick.currency)}
            />
            <MiniStat
              label="Target High"
              value={formatPrice(m.target_high_price ?? null, activePick.currency)}
            />
            <MiniStat
              label="Implied Upside"
              value={formatPctNullable(upsidePct, { sign: true })}
              tone={tonePct(upsidePct)}
            />
            <MiniStat
              label="Short % Float"
              value={formatPctNullable(m.short_pct_float)}
            />
            <MiniStat
              label="Short Ratio"
              value={formatRatio(m.short_ratio)}
            />
          </Grid>
        </Section>

        {/* Income / Events */}
        <Section title="Income & Events">
          <Grid cols={3}>
            <MiniStat
              label="Dividend Yield"
              value={formatPctNullable(m.dividend_yield)}
            />
            <MiniStat
              label="Dividend Rate"
              value={formatPrice(m.dividend_rate ?? null, activePick.currency)}
            />
            <MiniStat
              label="Payout Ratio"
              value={formatPctNullable(m.payout_ratio)}
            />
            <MiniStat
              label="Ex-Dividend"
              value={m.ex_dividend_date ? formatDate(m.ex_dividend_date) : "—"}
            />
            <MiniStat
              label="Next Earnings"
              value={
                m.next_earnings_date ? formatDate(m.next_earnings_date) : "—"
              }
            />
            <MiniStat
              label="Currency"
              value={activePick.currency}
            />
          </Grid>
        </Section>

        {/* Thesis */}
        <Section title="Thesis">
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-dim)]">
            {activePick.thesis_long}
          </p>
        </Section>

        {/* Position summary */}
        <div className="grid grid-cols-2 gap-px border-b border-[var(--color-border)] bg-[var(--color-border)]">
          <Stat
            label="Stance"
            value={activePick.stance.toUpperCase()}
            tone={
              activePick.stance === "long"
                ? "text-[var(--color-long)]"
                : activePick.stance === "bearish"
                  ? "text-[var(--color-bearish)]"
                  : "text-[var(--color-text-dim)]"
            }
          />
          <Stat
            label="Conviction"
            value={activePick.conviction.toUpperCase()}
            tone={
              activePick.conviction === "high"
                ? "text-[var(--color-conv-high)]"
                : activePick.conviction === "medium"
                  ? "text-[var(--color-conv-medium)]"
                  : "text-[var(--color-text-dim)]"
            }
          />
          <Stat
            label="Theme"
            value={theme?.label ?? activePick.theme}
            tone={theme ? undefined : "text-[var(--color-text-dim)]"}
            color={theme?.accent}
          />
          <Stat
            label="First Mentioned"
            value={formatDate(activePick.first_mentioned_at)}
          />
        </div>

        <div className="border-t border-[var(--color-border)] px-6 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold-dim)]">
            / Related Tweets ({tweetMarkers.length})
          </p>
          <div className="mt-3 space-y-2">
            {tweetMarkers.length === 0 ? (
              <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                No tweet references available for this stock.
              </p>
            ) : (
              tweetMarkers.map((tweet) => (
                <a
                  key={`${tweet.tweet_id}-${tweet.tweeted_at}`}
                  href={tweet.tweet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-sm border border-[var(--color-border-strong)] px-3 py-2 transition hover:border-[var(--color-gold)]"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
                    {formatDate(tweet.tweeted_at)}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-gold)]">
                    Open Tweet ↗
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function tonePct(n: number | null | undefined): string | undefined {
  if (n == null) return undefined;
  return n >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-6 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-gold-dim)]">
        / {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Grid({
  cols,
  children,
  className,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const gridCols =
    cols === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-border)] ${gridCols} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const isMissing = value === "—";
  return (
    <div className="bg-[var(--color-bg-elev)] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-sm font-medium ${
          tone ?? (isMissing ? "text-[var(--color-text-muted)]" : "text-white")
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-[var(--color-border-strong)] px-3 text-center font-mono text-[11px] text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

function RangeBar({
  current,
  low,
  high,
  currency,
}: {
  current: number | null;
  low: number | null;
  high: number | null;
  currency: string;
}) {
  if (current == null || low == null || high == null || high <= low) {
    return (
      <EmptyHint>52-week range data not available</EmptyHint>
    );
  }
  const pct = Math.max(0, Math.min(1, (current - low) / (high - low)));
  return (
    <div className="mt-2">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border-strong)]">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-down)] via-[var(--color-gold)] to-[var(--color-up)] opacity-70"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-white shadow-[0_0_0_2px_rgba(245,166,35,0.6)]"
          style={{ left: `${pct * 100}%` }}
          aria-label={`Current price ${formatPrice(current, currency)}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
        <span>{formatPrice(low, currency)}</span>
        <span className="text-white">
          {formatPrice(current, currency)}{" "}
          <span className="text-[var(--color-text-muted)]">
            ({(pct * 100).toFixed(0)}%)
          </span>
        </span>
        <span>{formatPrice(high, currency)}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  color,
}: {
  label: string;
  value: string;
  tone?: string;
  color?: string;
}) {
  return (
    <div className="bg-[var(--color-bg-elev)] px-6 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-base font-medium ${tone ?? "text-white"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
