"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceHistoryPoint } from "@/lib/schema";

type TweetMarker = {
  tweet_id: string;
  tweet_url: string;
  tweeted_at: string;
};

type TimeframeKey = "1M" | "3M" | "6M" | "1Y" | "5Y";

const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string; days: number }[] = [
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "5Y", label: "5Y", days: 365 * 5 },
];

export function Sparkline({
  data,
  positive,
  tweetMarkers = [],
}: {
  data: PriceHistoryPoint[];
  positive: boolean;
  tweetMarkers?: TweetMarker[];
}) {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>("1Y");
  const stroke = positive ? "#34d399" : "#f87171";
  const fillId = positive ? "spark-up" : "spark-down";
  const timeframe = TIMEFRAME_OPTIONS.find((option) => option.key === activeTimeframe);
  const filteredData = useMemo(
    () => filterHistoryByDays(data, timeframe?.days ?? 365),
    [data, timeframe],
  );
  const markerMap = useMemo(
    () => buildMarkerMap(filteredData, tweetMarkers),
    [filteredData, tweetMarkers],
  );
  const startLabel = formatTimestamp(filteredData[0]?.date ?? data[0]?.date ?? "");
  const endLabel = formatTimestamp(
    filteredData[filteredData.length - 1]?.date ?? data[data.length - 1]?.date ?? "",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1">
          {TIMEFRAME_OPTIONS.map((option) => {
            const active = option.key === activeTimeframe;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveTimeframe(option.key)}
                className={`rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
                  active
                    ? "bg-[var(--color-gold)] text-black"
                    : "text-[var(--color-text-muted)] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
          {startLabel} - {endLabel}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 6, right: 6, left: 6, bottom: 0 }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "#8a8a8a", fontSize: 10 }}
              tickFormatter={(value: string) => formatAxisDate(value, activeTimeframe)}
            />
            <Tooltip
              cursor={{ stroke: "#3a3a3a", strokeWidth: 1 }}
              labelFormatter={(label: string) => formatTimestamp(label)}
              content={({ active, payload, label }) => {
                if (
                  !active ||
                  !payload ||
                  payload.length === 0 ||
                  typeof label !== "string"
                ) {
                  return null;
                }
                const close = payload[0]?.value;
                if (typeof close !== "number") return null;
                const markerEvents = markerMap.get(label) ?? [];

                return (
                  <div
                    className="rounded border border-[#2a2a2a] bg-[#0a0a0a] p-2 font-mono text-[11px]"
                    style={{ minWidth: 180 }}
                  >
                    <p className="text-[#8a8a8a]">{formatTimestamp(label)}</p>
                    <p className="mt-1 text-white">
                      Close: <span className="font-semibold">{close.toFixed(2)}</span>
                    </p>
                    {markerEvents.length > 0 && (
                      <div className="mt-1 border-t border-[#222] pt-1 text-[#f5a623]">
                        {markerEvents.map((event) => (
                          <p key={event.tweet_id}>
                            Tweet marker · {formatTimestamp(event.tweeted_at)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #2a2a2a",
                borderRadius: 4,
                fontFamily: "var(--font-jetbrains)",
                fontSize: 11,
              }}
              labelStyle={{ color: "#8a8a8a" }}
              formatter={(value: number) => [value.toFixed(2), "Close"]}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
            />
            {Array.from(markerMap.entries()).flatMap(([date, events]) => {
              const point = filteredData.find((d) => d.date === date);
              if (!point) return [];
              return events.map((event, idx) => (
                <ReferenceDot
                  key={`${event.tweet_id}-${date}-${idx}`}
                  x={date}
                  y={point.close}
                  r={3}
                  fill="#f5a623"
                  stroke="#0a0a0a"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              ));
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function filterHistoryByDays(
  history: PriceHistoryPoint[],
  days: number,
): PriceHistoryPoint[] {
  if (history.length <= 2) return history;
  const endMs = toMs(history[history.length - 1].date);
  if (endMs == null) return history;
  const cutoffMs = endMs - days * 24 * 60 * 60 * 1000;
  const filtered = history.filter((point) => {
    const pointMs = toMs(point.date);
    return pointMs != null && pointMs >= cutoffMs;
  });
  if (filtered.length >= 2) return filtered;
  return history.slice(-Math.min(2, history.length));
}

function buildMarkerMap(
  history: PriceHistoryPoint[],
  markers: TweetMarker[],
): Map<string, TweetMarker[]> {
  const out = new Map<string, TweetMarker[]>();
  if (history.length === 0 || markers.length === 0) return out;

  const historyMs = history.map((point) => ({
    date: point.date,
    close: point.close,
    ms: toMs(point.date),
  }));

  for (const marker of markers) {
    const markerMs = toMs(marker.tweeted_at);
    if (markerMs == null) continue;
    let closest = historyMs[0];
    let distance = Math.abs((closest.ms ?? markerMs) - markerMs);

    for (let i = 1; i < historyMs.length; i++) {
      const candidate = historyMs[i];
      if (candidate.ms == null) continue;
      const candidateDistance = Math.abs(candidate.ms - markerMs);
      if (candidateDistance < distance) {
        closest = candidate;
        distance = candidateDistance;
      }
    }

    const row = out.get(closest.date) ?? [];
    row.push(marker);
    out.set(closest.date, row);
  }

  return out;
}

function toMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function formatAxisDate(value: string, timeframe: TimeframeKey): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const showYear = timeframe === "5Y";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "2-digit" } : {}),
  });
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes("T");
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(hasTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  });
}
