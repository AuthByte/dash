export type ChartRange = "1M" | "3M" | "YTD" | "1Y" | "ALL";

export const CHART_RANGES: ChartRange[] = ["1M", "3M", "YTD", "1Y", "ALL"];

export function cutoffDate(range: ChartRange, now = new Date()): string | null {
  if (range === "ALL") return null;
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (range === "YTD") {
    return `${d.getUTCFullYear()}-01-01`;
  }
  const months = range === "1M" ? 1 : range === "3M" ? 3 : 12;
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function sliceHistory<T extends { date: string }>(
  history: T[],
  range: ChartRange,
  now = new Date(),
): T[] {
  const start = cutoffDate(range, now);
  if (!start) return history;
  return history.filter((point) => point.date >= start);
}

export function capHistory<T>(history: T[], maxPoints = 800): T[] {
  if (history.length <= maxPoints) return history;
  return history.slice(history.length - maxPoints);
}

/** Snap a calendar date onto the nearest prior session present in `sessions`. */
export function snapToSession(
  isoDay: string,
  sessions: Iterable<string>,
  lookbackDays = 5,
): string | null {
  const available = sessions instanceof Set ? sessions : new Set(sessions);
  const day = isoDay.slice(0, 10);
  if (available.has(day)) return day;
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  for (let i = 0; i < lookbackDays; i += 1) {
    d.setUTCDate(d.getUTCDate() - 1);
    const candidate = d.toISOString().slice(0, 10);
    if (available.has(candidate)) return candidate;
  }
  return null;
}

export function isAllowedTicker(ticker: string): boolean {
  return /^[A-Za-z0-9.=^_-]{1,20}$/.test(ticker);
}
