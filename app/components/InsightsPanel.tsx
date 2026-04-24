"use client";

import { formatPct } from "@/lib/format";
import type { EnrichedPick, ThemeStats } from "@/lib/data";

export function InsightsPanel({
  themeStats,
  picks: _picks,
}: {
  themeStats: ThemeStats[];
  picks: EnrichedPick[];
}) {
  void _picks;

  return (
    <section className="w-full max-w-none">
      <article className="liquid-panel rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)]/90 p-5 sm:p-6">
        <header className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[var(--color-text-muted)]">
            Concepts mastered
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            By theme
          </h3>
        </header>
        <div className="space-y-4">
          {themeStats.slice(0, 5).map((item) => {
            const width = Math.min(100, Math.max(8, Math.abs(item.avg_ytd_pct)));
            const positive = item.avg_ytd_pct >= 0;
            return (
              <div
                key={item.theme.slug}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-dim)]">
                    {item.theme.label}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                        positive ? "bg-[var(--color-up)]" : "bg-[var(--color-down)]"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
                <p
                  className={`font-mono text-[11px] tabular-nums ${
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
    </section>
  );
}
