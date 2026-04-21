"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
  createChart,
  type AreaData,
  type AreaStyleOptions,
  type AreaSeriesOptions,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type SeriesOptionsCommon,
  type Time,
  type TimeChartOptions,
  type WhitespaceData,
} from "lightweight-charts";
import type { PriceHistoryPoint } from "@/lib/schema";

export function Sparkline({
  data,
  positive,
  tweetMarkers = [],
}: {
  data: PriceHistoryPoint[];
  positive: boolean;
  tweetMarkers?: {
    tweet_id: string;
    tweet_url: string;
    tweeted_at: string;
  }[];
}) {
  const stroke = positive ? "#34d399" : "#f87171";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef =
    useRef<
      ISeriesApi<
        "Area",
        Time,
        AreaData<Time> | WhitespaceData<Time>,
        AreaSeriesOptions,
        DeepPartial<AreaStyleOptions & SeriesOptionsCommon>
      > | null
    >(null);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markerUrlMapRef = useRef<Map<string, string>>(new Map());

  const chartData = useMemo(
    () =>
      data
        .filter((point) => Number.isFinite(point.close))
        .map((point) => ({
          time: point.date as Time,
          value: point.close,
        })),
    [data],
  );

  const markers = useMemo(() => {
    if (chartData.length === 0) return [];
    const availableDays = new Set(chartData.map((point) => point.time as string));
    return tweetMarkers
      .map((event) => {
        const day = event.tweeted_at.slice(0, 10);
        if (!availableDays.has(day)) return null;
        return {
          time: day as Time,
          position: "aboveBar" as const,
          color: "#f5a623",
          shape: "circle" as const,
          text: "T",
          size: 1,
          id: event.tweet_id,
          tweet_url: event.tweet_url,
        };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker != null);
  }, [chartData, tweetMarkers]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a6adbb",
        fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, monospace",
      },
      rightPriceScale: {
        visible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(245,166,35,0.45)",
          style: LineStyle.Solid,
          width: 1,
          labelBackgroundColor: "#151a21",
        },
        horzLine: {
          color: "rgba(245,166,35,0.25)",
          style: LineStyle.Dotted,
          width: 1,
          labelBackgroundColor: "#151a21",
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: stroke,
      topColor: positive ? "rgba(52, 211, 153, 0.26)" : "rgba(248, 113, 113, 0.24)",
      bottomColor: "rgba(0,0,0,0)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderColor: stroke,
      crosshairMarkerBackgroundColor: "#0b0f14",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    seriesMarkersRef.current = createSeriesMarkers<Time>(series, []);

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      chartRef.current.timeScale().fitContent();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    const onClick = (param: MouseEventParams<Time>) => {
      if (!param.hoveredObjectId) return;
      const url = markerUrlMapRef.current.get(String(param.hoveredObjectId));
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    };

    chart.subscribeClick(onClick);
    resize();

    return () => {
      chart.unsubscribeClick(onClick);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesMarkersRef.current = null;
    };
  }, [positive, stroke]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(chartData);
    chartRef.current.timeScale().fitContent();
  }, [chartData]);

  useEffect(() => {
    if (!seriesMarkersRef.current) return;
    markerUrlMapRef.current = new Map(
      markers.map((marker) => [String(marker.id), marker.tweet_url]),
    );
    seriesMarkersRef.current.setMarkers(
      markers.map((marker) => ({
        time: marker.time,
        position: marker.position,
        color: marker.color,
        shape: marker.shape,
        text: marker.text,
        size: marker.size,
        id: marker.id,
      })) as SeriesMarker<Time>[],
    );
  }, [markers]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {markers.length > 0 && (
        <div className="pointer-events-none absolute left-2 top-2 rounded border border-[var(--color-border-strong)] bg-[rgba(11,15,20,0.78)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-gold)]">
          T = tweet marker (click to open)
        </div>
      )}
    </div>
  );
}
