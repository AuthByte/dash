"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { PriceHistoryPoint } from "@/lib/schema";

export function Sparkline({
  data,
  positive,
}: {
  data: PriceHistoryPoint[];
  positive: boolean;
}) {
  const stroke = positive ? "#34d399" : "#f87171";
  const fillId = positive ? "spark-up" : "spark-down";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis
          hide
          domain={["dataMin", "dataMax"]}
        />
        <Tooltip
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
      </AreaChart>
    </ResponsiveContainer>
  );
}
