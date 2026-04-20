"use client";

import { formatPct } from "@/lib/format";
import type { EnrichedPick, ThemeStats } from "@/lib/data";

export function InsightsPanel({
  themeStats,
  picks,
}: {
  themeStats: ThemeStats[];
  picks: EnrichedPick[];
}) {
  const focusList = picks
    .filter((pick) => pick.metrics?.day_change_pct != null)
    .sort((a, b) => (a.metrics?.day_change_pct ?? 0) - (b.metrics?.day_change_pct ?? 0))
    .slice(0, 4);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-5">
        <header className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            Concepts Mastered
          </p>
          <h3 className="mt-1 text-3xl font-semibold text-white">By theme</h3>
        </header>
        <div className="space-y-3">
          {themeStats.slice(0, 5).map((item) => {
            const width = Math.min(100, Math.max(8, Math.abs(item.avg_ytd_pct)));
            const positive = item.avg_ytd_pct >= 0;
            return (
              <div key={item.theme.slug} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div>
                  <p className="text-sm text-[var(--color-text-dim)]">{item.theme.label}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className={`h-full rounded-full ${
                        positive ? "bg-[var(--color-up)]" : "bg-[var(--color-down)]"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
                <p
                  className={`font-mono text-[11px] ${
                    positive ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
                  }`}
                >
                  {formatPct(item.avg_ytd_pct, { sign: true })}
                </p>
              </div>
            );
          })}
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-5">
        <header className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            Where They&apos;re Struggling
          </p>
          <h3 className="mt-1 text-3xl font-semibold text-white">Watch-list</h3>
        </header>
        <div className="space-y-3">
          {focusList.map((pick) => (
            <div
              key={pick.ticker}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-white">{pick.ticker}</p>
                <p className="font-mono text-[11px] text-[var(--color-down)]">
                  {formatPct(pick.metrics?.day_change_pct ?? 0, { sign: true })}
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-dim)]">{pick.name}</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{pick.thesis_short}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
