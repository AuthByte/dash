/**
 * Map dashboard tickers (often Yahoo-style) to TradingView "EXCHANGE:SYMBOL" ids.
 * @see https://www.tradingview.com/widget-docs/
 */

const NASDAQ_EXCHANGES = new Set([
  "NMS",
  "NGM",
  "NCM",
  "NASDAQ",
  "NASDAQ GS",
  "NASDAQ GM",
  "NASDAQ CM",
]);

const NYSE_EXCHANGES = new Set(["NYQ", "NYSE", "NYE"]);

const AMEX_EXCHANGES = new Set(["ASE", "AMEX", "NYSE ARCA", "ARCA", "PCX"]);

const OTC_EXCHANGES = new Set(["OQB", "OQX", "PNK", "OTC", "OTCQB", "OTCQX", "PINK"]);

/** Yahoo suffix → TradingView prefix (base symbol without suffix). */
const YAHOO_SUFFIX_TV: Record<string, string> = {
  L: "LSE",
  ST: "STO",
  TO: "TSX",
  V: "TSXV",
  PA: "EURONEXTPARIS",
  DE: "XETR",
  F: "XETR",
  AS: "EURONEXTAMS",
  BR: "EURONEXTBRU",
  SW: "SIX",
  VI: "VIE",
  MI: "MIL",
  MC: "BME",
  T: "TSE",
  HK: "HKEX",
  AX: "ASX",
  NZ: "NZX",
  CO: "OMXCOP",
  OL: "OSL",
  HE: "OMXHEX",
  IC: "OMXICE",
  TA: "TASE",
};

function stripCryptoPair(ticker: string): string | null {
  const m = /^([A-Z0-9]{1,12})-USD$/i.exec(ticker.trim());
  if (!m) return null;
  return `COINBASE:${m[1].toUpperCase()}USD`;
}

/**
 * @param ticker Raw ticker from picks (e.g. AAPL, IQE.L, BTC-USD)
 * @param yahooExchange Optional `exchange` from Yahoo / refresh metrics (e.g. NMS, NYQ)
 */
export function toTradingViewSymbol(
  ticker: string,
  yahooExchange?: string | null,
): string {
  const raw = ticker.trim().toUpperCase();
  if (!raw) return "NASDAQ:AAPL";

  const crypto = stripCryptoPair(raw);
  if (crypto) return crypto;

  const dot = raw.lastIndexOf(".");
  if (dot > 0) {
    const base = raw.slice(0, dot);
    const suf = raw.slice(dot + 1);
    const tvEx = YAHOO_SUFFIX_TV[suf];
    if (tvEx && base.length > 0) return `${tvEx}:${base}`;
  }

  const ex = (yahooExchange ?? "").trim().toUpperCase();
  if (NASDAQ_EXCHANGES.has(ex) || ex.includes("NASDAQ")) {
    return `NASDAQ:${raw}`;
  }
  if (NYSE_EXCHANGES.has(ex)) return `NYSE:${raw}`;
  if (AMEX_EXCHANGES.has(ex)) return `AMEX:${raw}`;
  if (OTC_EXCHANGES.has(ex) || ex.includes("OTC")) return `OTC:${raw}`;
  if (ex === "BTS" || ex === "BATS") return `BATS:${raw}`;

  // Plain US-style ticker: default to NASDAQ (covers most tech picks).
  if (/^[A-Z]{1,5}$/.test(raw)) return `NASDAQ:${raw}`;

  return `NASDAQ:${raw}`;
}
