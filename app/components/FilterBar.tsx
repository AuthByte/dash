"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Theme } from "@/lib/schema";

const STANCES = [
  { slug: "all", label: "All" },
  { slug: "long", label: "Long" },
  { slug: "neutral", label: "Neutral" },
  { slug: "bearish", label: "Bearish" },
  { slug: "exited", label: "Exited" },
];

export function FilterBar({ themes }: { themes: Theme[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const activeTheme = params.get("theme") ?? "all";
  const activeStance = params.get("stance") ?? "all";

  const buildHref = (key: "theme" | "stance", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}#picks` : `${pathname}#picks`;
  };

  return (
    <div className="space-y-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-3">
      <FilterRow
        label="Theme"
        items={[
          { slug: "all", label: "All", accent: undefined },
          ...themes.map((t) => ({
            slug: t.slug,
            label: t.label,
            accent: t.accent,
          })),
        ]}
        active={activeTheme}
        buildHref={(slug) => buildHref("theme", slug)}
      />
      <FilterRow
        label="Stance"
        items={STANCES}
        active={activeStance}
        buildHref={(slug) => buildHref("stance", slug)}
      />
    </div>
  );
}

function FilterRow({
  label,
  items,
  active,
  buildHref,
}: {
  label: string;
  items: { slug: string; label: string; accent?: string }[];
  active: string;
  buildHref: (slug: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label}:
      </span>
      {items.map((item) => {
        const isActive = active === item.slug;
        return (
          <Link
            key={item.slug}
            href={buildHref(item.slug)}
            scroll={false}
            className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
              isActive
                ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                : "border-[var(--color-border-strong)] text-[var(--color-text-dim)] hover:border-[var(--color-text-dim)] hover:text-white"
            }`}
            style={
              isActive && item.accent
                ? {
                    borderColor: item.accent,
                    color: item.accent,
                    background: `${item.accent}1a`,
                  }
                : undefined
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
