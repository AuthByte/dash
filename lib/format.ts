export function formatPct(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPrice(n: number | null, currency: string): string {
  if (n == null) return "—";
  const symbol = currencySymbol(currency);
  if (n >= 1000) {
    return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${symbol}${n.toFixed(2)}`;
}

export function formatMarketCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export function formatLargeNumber(
  n: number | null | undefined,
  opts: { currency?: string } = {},
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const symbol = opts.currency ? currencySymbol(opts.currency) : "";
  if (abs >= 1_000_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatRatio(
  n: number | null | undefined,
  opts: { digits?: number; suffix?: string } = {},
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(opts.digits ?? 2)}${opts.suffix ?? ""}`;
}

export function formatPctNullable(
  n: number | null | undefined,
  opts: { sign?: boolean; digits?: number } = {},
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = opts.sign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(opts.digits ?? 2)}%`;
}

export function formatVolume(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toFixed(0)}`;
}

export function recommendationLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const map: Record<string, string> = {
    strong_buy: "Strong Buy",
    buy: "Buy",
    hold: "Hold",
    underperform: "Underperform",
    sell: "Sell",
    none: "—",
  };
  return map[key.toLowerCase()] ?? key.toUpperCase();
}

export function recommendationTone(
  key: string | null | undefined,
): "up" | "down" | "neutral" {
  if (!key) return "neutral";
  const k = key.toLowerCase();
  if (k === "strong_buy" || k === "buy") return "up";
  if (k === "sell" || k === "underperform") return "down";
  return "neutral";
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "GBp":
      return "p";
    case "SEK":
      return "kr ";
    default:
      return "";
  }
}
