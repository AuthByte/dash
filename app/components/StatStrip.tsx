import { formatPct } from "@/lib/format";
import type { HeadlineStats } from "@/lib/data";

export function StatStrip({ stats }: { stats: HeadlineStats }) {
  const items: {
    label: string;
    value: string;
    sub?: string;
    tone?: "up" | "down" | "neutral" | "gold";
  }[] = [
    {
      label: "Total Picks",
      value: `${stats.total}`,
      sub: `${stats.long_count} long • ${stats.other_count} other`,
      tone: "neutral",
    },
    {
      label: "Avg YTD (Longs)",
      value: formatPct(stats.avg_ytd_pct_longs, { sign: true }),
      sub: "Equal-weighted",
      tone: stats.avg_ytd_pct_longs >= 0 ? "up" : "down",
    },
    {
      label: "Best Performer",
      value: stats.best?.ticker ?? "—",
      sub: stats.best
        ? formatPct(stats.best.ytd_pct, { sign: true }) + " YTD"
        : "",
      tone: "up",
    },
    {
      label: "Worst Performer",
      value: stats.worst?.ticker ?? "—",
      sub: stats.worst
        ? formatPct(stats.worst.ytd_pct, { sign: true }) + " YTD"
        : "",
      tone: "down",
    },
    {
      label: "Highest Conviction",
      value: `${stats.highest_conviction_count}`,
      sub: "Top-tier names",
      tone: "gold",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <article
          key={item.label}
          className="group relative overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-4 transition hover:border-[var(--color-gold)]/40"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            {item.label}
          </p>
          <p
            className={`mt-3 font-mono text-2xl font-semibold ${toneClass(item.tone)}`}
          >
            {item.value}
          </p>
          {item.sub && (
            <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
              {item.sub}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}

function toneClass(tone?: "up" | "down" | "neutral" | "gold"): string {
  switch (tone) {
    case "up":
      return "text-[var(--color-up)]";
    case "down":
      return "text-[var(--color-down)]";
    case "gold":
      return "text-[var(--color-gold)]";
    default:
      return "text-white";
  }
}
