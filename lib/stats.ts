export type TapeExtreme = { ticker: string; ytd_pct: number };

export type HeadlineStats = {
  total: number;
  long_count: number;
  other_count: number;
  avg_ytd_pct_longs: number | null;
  best: TapeExtreme | null;
  worst: TapeExtreme | null;
  highest_conviction_count: number;
};

export type HeadlinePick = {
  ticker: string;
  stance: string;
  conviction: string;
  ytd_pct: number;
};

export function getHeadlineStats(picks: HeadlinePick[]): HeadlineStats {
  const longs = picks.filter((p) => p.stance === "long");
  const others = picks.filter((p) => p.stance !== "long");
  const avg =
    longs.length === 0
      ? null
      : longs.reduce((sum, p) => sum + p.ytd_pct, 0) / longs.length;
  if (picks.length === 0) {
    return {
      total: 0,
      long_count: 0,
      other_count: 0,
      avg_ytd_pct_longs: null,
      best: null,
      worst: null,
      highest_conviction_count: 0,
    };
  }
  const sorted = [...picks].sort((a, b) => b.ytd_pct - a.ytd_pct);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    total: picks.length,
    long_count: longs.length,
    other_count: others.length,
    avg_ytd_pct_longs: avg,
    best: first ? { ticker: first.ticker, ytd_pct: first.ytd_pct } : null,
    worst: last ? { ticker: last.ticker, ytd_pct: last.ytd_pct } : null,
    highest_conviction_count: picks.filter((p) => p.conviction === "high")
      .length,
  };
}
