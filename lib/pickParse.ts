import { PickSchema, type Pick } from "./schema";

export function sanitizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return trimmed;
  } catch {
    return "";
  }
}

function kebabTheme(value: unknown): string {
  if (typeof value !== "string") return "macro";
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "macro";
}

export function parsePickRow(raw: unknown): Pick | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const events = Array.isArray(row.tweet_events)
    ? row.tweet_events.map((event) => {
        if (!event || typeof event !== "object") return event;
        const ev = event as Record<string, unknown>;
        return {
          ...ev,
          tweet_url: sanitizeUrl(ev.tweet_url),
        };
      })
    : undefined;
  const candidate = {
    ...row,
    ticker: typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : row.ticker,
    theme: kebabTheme(row.theme),
    tweet_url: sanitizeUrl(row.tweet_url),
    tweet_id: typeof row.tweet_id === "string" ? row.tweet_id : "",
    first_mentioned_at:
      typeof row.first_mentioned_at === "string" ? row.first_mentioned_at : "",
    thesis_short: typeof row.thesis_short === "string" ? row.thesis_short : "",
    thesis_long: typeof row.thesis_long === "string" ? row.thesis_long : "",
    name: typeof row.name === "string" ? row.name : "",
    tweet_events: events,
  };
  const parsed = PickSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parsePickRows(raw: unknown): Pick[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Pick[] = [];
  for (const row of raw) {
    const pick = parsePickRow(row);
    if (!pick) continue;
    if (seen.has(pick.ticker)) continue;
    seen.add(pick.ticker);
    out.push(pick);
  }
  return out;
}
