"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EnrichedPick } from "@/lib/data";
import type { Stance, Theme } from "@/lib/schema";
import { FilterBar } from "./FilterBar";
import { PicksTable, type SortKey, type SortDir } from "./PicksTable";
import { PickDrawer } from "./PickDrawer";

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
}: {
  picks: EnrichedPick[];
  themes: Theme[];
}) {
  const params = useSearchParams();
  const themeFilter = params.get("theme") ?? "all";
  const stanceFilter = (params.get("stance") ?? "all") as
    | Stance
    | "all";

  const [sortKey, setSortKey] = useState<SortKey>("first_mentioned_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const themeMap = useMemo(
    () => new Map(themes.map((t) => [t.slug, t] as const)),
    [themes],
  );

  const filtered = useMemo(() => {
    return picks.filter((p) => {
      if (themeFilter !== "all" && p.theme !== themeFilter) return false;
      if (
        stanceFilter !== "all" &&
        STANCE_VALUES.includes(stanceFilter) &&
        p.stance !== stanceFilter
      )
        return false;
      return true;
    });
  }, [picks, themeFilter, stanceFilter]);

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
      <PickDrawer
        pick={activePick}
        theme={activeTheme}
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
