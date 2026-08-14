import { formatPct } from "@/lib/format";
import type { HeadlineStats } from "@/lib/data";

export function StatStrip({ stats }: { stats: HeadlineStats }) {
  const items: {
    label: string;
    value: string;
    sub?: string;
    tone?: "up" | "down" | "neutral" | "gold";
    span: string;
  }[] = [
    {
      label: "Total picks",
      value: `${stats.total}`,
      sub: `${stats.long_count} long · ${stats.other_count} other`,
      tone: "neutral",
      span: "col-span-12 md:col-span-4",
    },
    {
      label: "Avg YTD (longs)",
      value: formatPct(stats.avg_ytd_pct_longs, { sign: true }),
      sub: "Equal-weighted sleeve",
      tone: stats.avg_ytd_pct_longs >= 0 ? "up" : "down",
      span: "col-span-12 md:col-span-8",
    },
    {
      label: "Best tape",
      value: stats.best?.ticker ?? "—",
      sub: stats.best
        ? formatPct(stats.best.ytd_pct, { sign: true }) + " YTD"
        : "",
      tone: "up",
      span: "col-span-6 md:col-span-4",
    },
    {
      label: "Worst tape",
      value: stats.worst?.ticker ?? "—",
      sub: stats.worst
        ? formatPct(stats.worst.ytd_pct, { sign: true }) + " YTD"
        : "",
      tone: "down",
      span: "col-span-6 md:col-span-4",
    },
    {
      label: "High conviction",
      value: `${stats.highest_conviction_count}`,
      sub: "Names flagged top tier",
      tone: "gold",
      span: "col-span-12 md:col-span-4",
    },
  ];

  return (
    <section className="grid grid-cols-12 gap-3 sm:gap-4">
      {items.map((item, i) => (
        <article
          key={item.label}
          style={{ animationDelay: `${i * 55}ms` }}
          className={`animate-fade-up group relative min-h-[140px] overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)]/90 px-5 py-5 transition-[border-color,box-shadow] duration-300 ease-out hover:border-[var(--color-gold)]/30 liquid-panel sm:px-6 sm:py-6 ${item.span}`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[var(--color-text-muted)]">
            {item.label}
          </p>
          <p
            className={`mt-3 font-mono text-3xl leading-none font-semibold tracking-tight sm:text-4xl ${toneClass(item.tone)}`}
          >
            {item.value}
          </p>
          {item.sub && (
            <p className="mt-3 text-sm leading-snug text-[var(--color-text-dim)]">
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
