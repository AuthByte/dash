"""Fetch quote/history/metrics from yfinance for a single ticker."""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timezone
from typing import Any

import yfinance as yf


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        out = float(value)
        return out if out == out else None
    try:
        out = float(value)
        return out if out == out else None
    except (TypeError, ValueError):
        return None


def to_int(value: Any) -> int | None:
    as_float = to_float(value)
    if as_float is None:
        return None
    return int(as_float)


def to_iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    return None


def clean_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in metrics.items() if v is not None}


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch yfinance data for a ticker.")
    parser.add_argument("--ticker", required=True, help="Ticker symbol (e.g. RDDT, IQE.L)")
    parser.add_argument(
        "--years",
        type=int,
        default=5,
        help="How many years of daily history to request.",
    )
    args = parser.parse_args()

    ticker = yf.Ticker(args.ticker)

    info: dict[str, Any] = {}
    try:
        maybe_info = ticker.info
        if isinstance(maybe_info, dict):
            info = maybe_info
    except Exception:
        info = {}

    fast_info: dict[str, Any] = {}
    try:
        maybe_fast = ticker.fast_info
        if maybe_fast is not None:
            fast_info = dict(maybe_fast)
    except Exception:
        fast_info = {}

    history: list[dict[str, Any]] = []
    try:
        hist = ticker.history(
            period=f"{args.years}y",
            interval="1d",
            auto_adjust=False,
            actions=False,
        )
        if not hist.empty:
            for idx, row in hist.iterrows():
                close = to_float(row.get("Close"))
                if close is None:
                    continue
                day = to_iso_date(idx)
                if day is None:
                    continue
                history.append({"date": day, "close": close})
    except Exception:
        history = []

    history.sort(key=lambda row: row["date"])

    metrics = clean_metrics(
        {
            "prev_close": to_float(info.get("previousClose")),
            "open": to_float(info.get("open")),
            "day_high": to_float(info.get("dayHigh")),
            "day_low": to_float(info.get("dayLow")),
            "day_change_pct": to_float(info.get("regularMarketChangePercent")),
            "volume": to_float(info.get("volume")),
            "avg_volume": to_float(info.get("averageVolume")),
            "fifty_two_week_high": to_float(info.get("fiftyTwoWeekHigh") or info.get("yearHigh")),
            "fifty_two_week_low": to_float(info.get("fiftyTwoWeekLow") or info.get("yearLow")),
            "fifty_day_avg": to_float(info.get("fiftyDayAverage")),
            "two_hundred_day_avg": to_float(info.get("twoHundredDayAverage")),
            "pe_trailing": to_float(info.get("trailingPE")),
            "pe_forward": to_float(info.get("forwardPE")),
            "peg_ratio": to_float(info.get("pegRatio")),
            "price_to_book": to_float(info.get("priceToBook")),
            "price_to_sales": to_float(info.get("priceToSalesTrailing12Months")),
            "ev_to_revenue": to_float(info.get("enterpriseToRevenue")),
            "ev_to_ebitda": to_float(info.get("enterpriseToEbitda")),
            "enterprise_value": to_float(info.get("enterpriseValue")),
            "eps_trailing": to_float(info.get("trailingEps")),
            "eps_forward": to_float(info.get("forwardEps")),
            "shares_outstanding": to_float(info.get("sharesOutstanding")),
            "float_shares": to_float(info.get("floatShares")),
            "total_revenue": to_float(info.get("totalRevenue")),
            "revenue_growth": to_float(info.get("revenueGrowth")),
            "earnings_growth": to_float(info.get("earningsGrowth")),
            "gross_margin": to_float(info.get("grossMargins")),
            "operating_margin": to_float(info.get("operatingMargins")),
            "profit_margin": to_float(info.get("profitMargins")),
            "ebitda_margin": to_float(info.get("ebitdaMargins")),
            "return_on_equity": to_float(info.get("returnOnEquity")),
            "return_on_assets": to_float(info.get("returnOnAssets")),
            "total_cash": to_float(info.get("totalCash")),
            "total_debt": to_float(info.get("totalDebt")),
            "debt_to_equity": to_float(info.get("debtToEquity")),
            "current_ratio": to_float(info.get("currentRatio")),
            "quick_ratio": to_float(info.get("quickRatio")),
            "free_cashflow": to_float(info.get("freeCashflow")),
            "operating_cashflow": to_float(info.get("operatingCashflow")),
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": to_float(info.get("recommendationMean")),
            "num_analysts": to_float(info.get("numberOfAnalystOpinions")),
            "target_mean_price": to_float(info.get("targetMeanPrice")),
            "target_high_price": to_float(info.get("targetHighPrice")),
            "target_low_price": to_float(info.get("targetLowPrice")),
            "beta": to_float(info.get("beta")),
            "short_pct_float": to_float(info.get("shortPercentOfFloat")),
            "short_ratio": to_float(info.get("shortRatio")),
            "dividend_yield": to_float(info.get("dividendYield")),
            "dividend_rate": to_float(info.get("dividendRate")),
            "payout_ratio": to_float(info.get("payoutRatio")),
            "ex_dividend_date": to_iso_date(info.get("exDividendDate")),
            "next_earnings_date": to_iso_date(
                info.get("earningsTimestamp") or info.get("nextFiscalYearEnd")
            ),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("fullExchangeName") or info.get("exchange"),
        }
    )

    payload = {
        "price": to_float(
            fast_info.get("lastPrice")
            or fast_info.get("last_price")
            or info.get("currentPrice")
            or info.get("regularMarketPrice")
        ),
        "market_cap": to_float(
            fast_info.get("marketCap")
            or fast_info.get("market_cap")
            or info.get("marketCap")
        ),
        "currency": info.get("currency"),
        "history": history,
        "metrics": metrics,
    }

    print(json.dumps(payload, separators=(",", ":"), ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
