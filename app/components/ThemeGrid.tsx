"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPct } from "@/lib/format";
import type { ThemeStats } from "@/lib/data";

export function ThemeGrid({ stats }: { stats: ThemeStats[] }) {
  const params = useSearchParams();
  const activeTheme = params.get("theme");

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {stats.map((s) => {
        const isActive = activeTheme === s.theme.slug;
        const tone = s.avg_ytd_pct >= 0 ? "up" : "down";
        const next = new URLSearchParams(params.toString());
        if (isActive) next.delete("theme");
        else next.set("theme", s.theme.slug);
        const href = `/?${next.toString()}#picks`;
        return (
          <Link
            key={s.theme.slug}
            href={href}
            scroll={false}
            className={`group relative overflow-hidden rounded-md border bg-[var(--color-bg-card)] p-4 transition hover:translate-y-[-1px] ${
              isActive
                ? "border-[var(--color-gold)]"
                : "border-[var(--color-border-strong)] hover:border-[var(--color-text-dim)]"
            }`}
          >
            <span
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: s.theme.accent }}
            />
            <div className="flex items-baseline justify-between">
              <p
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: s.theme.accent }}
              >
                {s.theme.label}
              </p>
            </div>
            <p className="mt-2 font-mono text-3xl font-semibold text-white">
              {s.count}
            </p>
            <p
              className={`mt-1 font-mono text-[11px] ${
                tone === "up"
                  ? "text-[var(--color-up)]"
                  : "text-[var(--color-down)]"
              }`}
            >
              {formatPct(s.avg_ytd_pct, { sign: true })} avg YTD
            </p>
          </Link>
        );
      })}
    </section>
  );
}
