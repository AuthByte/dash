"use client";

import { formatPct, formatPrice } from "@/lib/format";
import type { EnrichedPick } from "@/lib/data";
import type { Theme } from "@/lib/schema";

export function HighlightsPanel({
  picks,
  themeMap,
}: {
  picks: EnrichedPick[];
  themeMap: Map<string, Theme>;
}) {
  const featured = picks
    .filter((pick) => pick.stance !== "exited")
    .sort((a, b) => b.ytd_pct - a.ytd_pct)
    .slice(0, 2);

  if (featured.length === 0) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {featured.map((pick) => (
        <article
          key={pick.ticker}
          className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-semibold leading-none text-white">{pick.ticker}</p>
              <p className="mt-1 text-sm text-[var(--color-text-dim)]">{pick.name}</p>
            </div>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]">
              {pick.conviction}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="Price" value={formatPrice(pick.price, pick.currency)} />
            <Metric
              label="YTD"
              value={formatPct(pick.ytd_pct, { sign: true })}
              tone={pick.ytd_pct >= 0 ? "up" : "down"}
            />
            <Metric
              label="Theme"
              value={themeMap.get(pick.theme)?.label ?? pick.theme}
              tone="gold"
            />
          </div>

          <p className="mt-4 text-sm text-[var(--color-text-dim)]">{pick.thesis_short}</p>
        </article>
      ))}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "gold";
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          tone === "up"
            ? "text-[var(--color-up)]"
            : tone === "down"
              ? "text-[var(--color-down)]"
              : tone === "gold"
                ? "text-[var(--color-gold)]"
                : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
