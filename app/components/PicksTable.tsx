"use client";

import type { EnrichedPick } from "@/lib/data";
import type { Theme } from "@/lib/schema";
import {
  formatDate,
  formatMarketCap,
  formatPct,
  formatPctNullable,
  formatPrice,
} from "@/lib/format";

export type SortKey =
  | "ticker"
  | "name"
  | "stance"
  | "conviction"
  | "price"
  | "day"
  | "ytd"
  | "market_cap"
  | "pe"
  | "theme"
  | "first_mentioned_at";
export type SortDir = "asc" | "desc";

const COLUMNS: {
  key: SortKey | "_idx" | "_thesis" | "_tweet";
  label: string;
  sortable: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}[] = [
  { key: "_idx", label: "#", sortable: false, align: "right", className: "w-10" },
  { key: "ticker", label: "Ticker", sortable: true },
  { key: "name", label: "Name", sortable: true },
  { key: "stance", label: "Stance", sortable: true, align: "center" },
  { key: "conviction", label: "Conviction", sortable: true, align: "center" },
  { key: "price", label: "Price", sortable: true, align: "right" },
  { key: "day", label: "Day %", sortable: true, align: "right" },
  { key: "ytd", label: "YTD %", sortable: true, align: "right" },
  { key: "market_cap", label: "Mkt Cap", sortable: true, align: "right" },
  { key: "pe", label: "P/E", sortable: true, align: "right" },
  { key: "theme", label: "Theme", sortable: true },
  { key: "_thesis", label: "Thesis", sortable: false },
  { key: "first_mentioned_at", label: "First Mentioned", sortable: true },
  { key: "_tweet", label: "Tweet", sortable: false, align: "center" },
];

export function PicksTable({
  picks,
  themeMap,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: {
  picks: EnrichedPick[];
  themeMap: Map<string, Theme>;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onSelect: (ticker: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)]">
      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]">
              {COLUMNS.map((col) => {
                const isSortable = col.sortable;
                const isActive = isSortable && col.key === sortKey;
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    } ${col.className ?? ""}`}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key as SortKey)}
                        className={`inline-flex items-center gap-1 transition hover:text-white ${
                          isActive ? "text-[var(--color-gold)]" : ""
                        }`}
                      >
                        <span>{col.label}</span>
                        <SortGlyph
                          active={isActive}
                          dir={isActive ? sortDir : undefined}
                        />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {picks.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center font-mono text-xs text-[var(--color-text-muted)]"
                >
                  No picks match the current filters.
                </td>
              </tr>
            ) : (
              picks.map((p, i) => (
                <PickRow
                  key={p.ticker}
                  pick={p}
                  index={i + 1}
                  theme={themeMap.get(p.theme)}
                  onSelect={onSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="divide-y divide-[var(--color-border)] md:hidden">
        {picks.length === 0 ? (
          <div className="px-3 py-12 text-center font-mono text-xs text-[var(--color-text-muted)]">
            No picks match the current filters.
          </div>
        ) : (
          picks.map((p) => (
            <MobilePickCard
              key={p.ticker}
              pick={p}
              theme={themeMap.get(p.theme)}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PickRow({
  pick,
  index,
  theme,
  onSelect,
}: {
  pick: EnrichedPick;
  index: number;
  theme?: Theme;
  onSelect: (t: string) => void;
}) {
  const ytdTone = pick.ytd_pct >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
  const dayChange = pick.metrics?.day_change_pct ?? null;
  const dayTone =
    dayChange == null
      ? "text-[var(--color-text-muted)]"
      : dayChange >= 0
        ? "text-[var(--color-up)]"
        : "text-[var(--color-down)]";
  const pe = pick.metrics?.pe_trailing ?? null;
  return (
    <tr
      className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-white/[0.02]"
      onClick={() => onSelect(pick.ticker)}
    >
      <td className="px-3 py-2.5 text-right font-mono text-[11px] text-[var(--color-text-muted)]">
        {index}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-sm font-semibold text-white">{pick.ticker}</span>
      </td>
      <td className="px-3 py-2.5 text-[var(--color-text-dim)]">{pick.name}</td>
      <td className="px-3 py-2.5 text-center">
        <StanceChip stance={pick.stance} />
      </td>
      <td className="px-3 py-2.5 text-center">
        <ConvictionChip conviction={pick.conviction} />
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-sm text-white">
        {formatPrice(pick.price, pick.currency)}
      </td>
      <td className={`px-3 py-2.5 text-right font-mono text-sm ${dayTone}`}>
        {formatPctNullable(dayChange, { sign: true })}
      </td>
      <td className={`px-3 py-2.5 text-right font-mono text-sm ${ytdTone}`}>
        {formatPct(pick.ytd_pct, { sign: true })}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-sm text-[var(--color-text-dim)]">
        {formatMarketCap(pick.market_cap)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-sm text-[var(--color-text-dim)]">
        {pe != null ? pe.toFixed(1) : "—"}
      </td>
      <td className="px-3 py-2.5">
        {theme && <ThemeChip theme={theme} />}
      </td>
      <td className="max-w-[18rem] px-3 py-2.5">
        <p className="truncate text-[var(--color-text-dim)]" title={pick.thesis_short}>
          {pick.thesis_short}
        </p>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted)]">
        {formatDate(pick.first_mentioned_at)}
      </td>
      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <a
          href={pick.tweet_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border-strong)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
        >
          <span aria-hidden>X</span>
          <span>Tweet</span>
        </a>
      </td>
    </tr>
  );
}

function MobilePickCard({
  pick,
  theme,
  onSelect,
}: {
  pick: EnrichedPick;
  theme?: Theme;
  onSelect: (t: string) => void;
}) {
  const ytdTone = pick.ytd_pct >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
  const day = pick.metrics?.day_change_pct ?? null;
  const dayTone =
    day == null
      ? "text-[var(--color-text-muted)]"
      : day >= 0
        ? "text-[var(--color-up)]"
        : "text-[var(--color-down)]";
  return (
    <button
      type="button"
      onClick={() => onSelect(pick.ticker)}
      className="block w-full px-4 py-4 text-left transition hover:bg-white/[0.02]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-base font-semibold text-white">{pick.ticker}</p>
          <p className="text-xs text-[var(--color-text-dim)]">{pick.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-white">
            {formatPrice(pick.price, pick.currency)}
          </p>
          <div className="flex items-center justify-end gap-2 font-mono text-xs">
            <span className={dayTone}>
              {formatPctNullable(day, { sign: true })}
            </span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className={ytdTone}>
              {formatPct(pick.ytd_pct, { sign: true })} YTD
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StanceChip stance={pick.stance} />
        <ConvictionChip conviction={pick.conviction} />
        {theme && <ThemeChip theme={theme} />}
        <span className="ml-auto font-mono text-[10px] text-[var(--color-text-muted)]">
          {formatDate(pick.first_mentioned_at)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-dim)]">
        {pick.thesis_short}
      </p>
    </button>
  );
}

function StanceChip({ stance }: { stance: EnrichedPick["stance"] }) {
  const map = {
    long: { color: "var(--color-long)", label: "LONG" },
    bearish: { color: "var(--color-bearish)", label: "BEARISH" },
    neutral: { color: "var(--color-neutral)", label: "NEUTRAL" },
    exited: { color: "var(--color-exited)", label: "EXITED" },
  } as const;
  const s = map[stance];
  return (
    <span
      className="inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]"
      style={{
        borderColor: s.color,
        color: s.color,
        background: `${s.color}14`,
      }}
    >
      {s.label}
    </span>
  );
}

function ConvictionChip({ conviction }: { conviction: EnrichedPick["conviction"] }) {
  const map = {
    high: { color: "var(--color-conv-high)", label: "HIGH" },
    medium: { color: "var(--color-conv-medium)", label: "MEDIUM" },
    low: { color: "var(--color-conv-low)", label: "LOW" },
  } as const;
  const c = map[conviction];
  return (
    <span
      className="inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]"
      style={{
        borderColor: c.color,
        color: c.color,
        background: `${c.color}14`,
      }}
    >
      {c.label}
    </span>
  );
}

function ThemeChip({ theme }: { theme: Theme }) {
  return (
    <span
      className="inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]"
      style={{
        borderColor: theme.accent,
        color: theme.accent,
        background: `${theme.accent}14`,
      }}
    >
      {theme.label}
    </span>
  );
}

function SortGlyph({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) return <span className="text-[var(--color-text-muted)]">↕</span>;
  return <span>{dir === "asc" ? "↑" : "↓"}</span>;
}
