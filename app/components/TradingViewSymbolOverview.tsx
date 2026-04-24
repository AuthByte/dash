"use client";

import { useEffect, useRef } from "react";

type Props = {
  symbol: string;
  className?: string;
};

/**
 * Embeds TradingView's Mini Symbol Overview (free widget).
 * @see https://www.tradingview.com/widget-docs/widgets/charts/symbol-overview/
 */
export function TradingViewSymbolOverview({ symbol, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const slot = document.createElement("div");
    slot.className = "tradingview-widget-container__widget";
    slot.style.height = "100%";
    slot.style.width = "100%";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "12M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      chartType: "area",
      largeChartUrl: "",
    });

    container.appendChild(slot);
    container.appendChild(script);
    host.appendChild(container);

    return () => {
      host.replaceChildren();
    };
  }, [symbol]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ minHeight: 260 }}
      aria-label={`TradingView chart for ${symbol}`}
    />
  );
}
