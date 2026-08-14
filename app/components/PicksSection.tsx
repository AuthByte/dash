"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EnrichedPick } from "@/lib/data";
import type { Stance, Theme } from "@/lib/schema";
import { FilterBar } from "./FilterBar";
import { PicksTable, type SortKey, type SortDir } from "./PicksTable";
import { PickDrawer } from "./PickDrawer";
import { TweetsByStockPanel } from "./TweetsByStockPanel";

const STANCE_VALUES: (Stance | "all")[] = [
  "all",
  "long",
  "neutral",
  "bearish",
  "exited",
];

export function PicksSection({
  picks,
  themes,
  personSlug,
}: {
  picks: EnrichedPick[];
  themes: Theme[];
  personSlug: string;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const themeFilter = params.get("theme") ?? "all";
  const stanceFilter = (params.get("stance") ?? "all") as
    | Stance
    | "all";
  const query = params.get("q") ?? "";

  const [sortKey, setSortKey] = useState<SortKey>("first_mentioned_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const themeMap = useMemo(
    () => new Map(themes.map((t) => [t.slug, t] as const)),
    [themes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return picks.filter((p) => {
      if (themeFilter !== "all" && p.theme !== themeFilter) return false;
      if (
        stanceFilter !== "all" &&
        STANCE_VALUES.includes(stanceFilter) &&
        p.stance !== stanceFilter
      )
        return false;
      if (q) {
        const hay = `${p.ticker} ${p.name} ${p.thesis_short} ${p.theme}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [picks, themeFilter, stanceFilter, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp = compareBy(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "name" ? "asc" : "desc");
    }
  };

  const activePick = activeTicker
    ? picks.find((p) => p.ticker === activeTicker) ?? null
    : null;
  const activeTheme = activePick ? themeMap.get(activePick.theme) ?? null : null;

  return (
    <section id="picks" className="scroll-mt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          / All Picks
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          {sorted.length} / {picks.length} shown
        </p>
      </div>
      <FilterBar themes={themes} />
      <div className="mt-3">
        <label className="sr-only" htmlFor="pick-search">
          Search tickers
        </label>
        <input
          id="pick-search"
          type="search"
          value={query}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            const value = e.target.value;
            if (value) next.set("q", value);
            else next.delete("q");
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }}
          placeholder="Filter by ticker, name, or thesis…"
          className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-3 py-2 font-mono text-sm text-white outline-none ring-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] focus:ring-1"
        />
      </div>
      <div className="mt-4">
        <PicksTable
          picks={sorted}
          themeMap={themeMap}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onSelect={setActiveTicker}
        />
      </div>
      <div className="mt-6">
        <TweetsByStockPanel picks={sorted} />
      </div>
      <PickDrawer
        pick={activePick}
        theme={activeTheme}
        personSlug={personSlug}
        onClose={() => setActiveTicker(null)}
      />
    </section>
  );
}

function compareBy(a: EnrichedPick, b: EnrichedPick, key: SortKey): number {
  switch (key) {
    case "ticker":
      return a.ticker.localeCompare(b.ticker);
    case "name":
      return a.name.localeCompare(b.name);
    case "stance":
      return a.stance.localeCompare(b.stance);
    case "conviction":
      return convictionRank(a.conviction) - convictionRank(b.conviction);
    case "price":
      return (a.price ?? -Infinity) - (b.price ?? -Infinity);
    case "day":
      return (
        (a.metrics?.day_change_pct ?? -Infinity) -
        (b.metrics?.day_change_pct ?? -Infinity)
      );
    case "ytd":
      return a.ytd_pct - b.ytd_pct;
    case "market_cap":
      return (a.market_cap ?? -Infinity) - (b.market_cap ?? -Infinity);
    case "pe":
      return (
        (a.metrics?.pe_trailing ?? Infinity) -
        (b.metrics?.pe_trailing ?? Infinity)
      );
    case "theme":
      return a.theme.localeCompare(b.theme);
    case "first_mentioned_at":
      return (
        new Date(a.first_mentioned_at).getTime() -
        new Date(b.first_mentioned_at).getTime()
      );
  }
}

function convictionRank(c: string): number {
  if (c === "high") return 3;
  if (c === "medium") return 2;
  return 1;
}
