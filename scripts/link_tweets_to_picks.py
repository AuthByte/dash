"""Attach real tweet events to picks from a raw scrape file.

Matches are based on:
- explicit cashtags / tickers in tweet text
- company name aliases inferred from the pick name

This updates each pick with:
- tweet_events: all matched tweets (sorted oldest->newest)
- tweet_id/tweet_url/first_mentioned_at: canonical earliest matched tweet
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

from common import ROOT, read_json, write_json

PICKS_PATH = ROOT / "data" / "people" / "serenity" / "picks.json"
RAW_DEFAULT = ROOT / "scrape-output" / f"raw-{dt.date.today().isoformat()}.json"

STOPWORDS = {
    "inc",
    "inc.",
    "corp",
    "corp.",
    "corporation",
    "co",
    "co.",
    "company",
    "holdings",
    "holding",
    "plc",
    "ab",
    "sa",
    "group",
    "limited",
    "ltd",
    "ltd.",
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip()


def split_words(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", value.lower())


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def ticker_variants(ticker: str) -> set[str]:
    base = normalize_ticker(ticker)
    out = {base}
    root = base.split(".")[0]
    out.add(root)
    if "." in base:
        out.add(base.replace(".", ""))
    return {x for x in out if x}


def ticker_patterns(ticker: str) -> list[re.Pattern[str]]:
    variants = sorted(ticker_variants(ticker), key=len, reverse=True)
    pats: list[re.Pattern[str]] = []
    for v in variants:
        escaped = re.escape(v)
        pats.append(re.compile(rf"(?<![A-Z0-9])\${escaped}(?![A-Z0-9])", re.IGNORECASE))
        pats.append(re.compile(rf"(?<![A-Z0-9]){escaped}(?![A-Z0-9])", re.IGNORECASE))
    return pats


def build_aliases(name: str) -> set[str]:
    words = [w for w in split_words(name) if w not in STOPWORDS and len(w) > 2]
    aliases: set[str] = set()

    full = normalize_text(name)
    if full:
        aliases.add(full)

    if words:
        aliases.add(" ".join(words))
        if len(words) >= 2:
            aliases.add(f"{words[0]} {words[1]}")

    # Manual high-signal aliases for known picks
    manual = {
        "lightwave logic": {"lwlg", "lightwave"},
        "applied optoelectronics": {"applied optoelectronics", "applied opto"},
        "aehr test systems": {"aehr", "aehr test"},
        "sivers semiconductors": {"sivers"},
        "circle internet group": {"circle"},
        "reddit inc": {"reddit"},
        "raspberry pi holdings": {"raspberry pi"},
        "soitec": {"soitec"},
        "iqe plc": {"iqe"},
        "powell industries": {"powell"},
        "lumentum holdings": {"lumentum"},
        "axt inc": {"axt"},
        "alleima ab": {"alleima"},
    }
    for key, vals in manual.items():
        if key in full:
            aliases.update(vals)

    return {a for a in aliases if a}


def parse_tweet_date(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        # Example: Mon Apr 20 23:43:14 +0000 2026
        dt_obj = dt.datetime.strptime(raw, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        return None
    return dt_obj.date().isoformat()


def tweet_blob(tweet: dict[str, Any]) -> str:
    parts = [
        str(tweet.get("text") or ""),
        str(tweet.get("quoted_text") or ""),
    ]
    return normalize_text(" ".join(parts))


def matches_pick(
    tweet: dict[str, Any],
    ticker_pats: list[re.Pattern[str]],
    aliases: set[str],
) -> bool:
    blob_raw = f"{tweet.get('text', '')}\n{tweet.get('quoted_text', '')}"
    blob = tweet_blob(tweet)
    if not blob:
        return False

    for pat in ticker_pats:
        if pat.search(blob_raw):
            return True

    for alias in aliases:
        if len(alias) < 3:
            continue
        if alias in blob:
            return True

    return False


def canonical_event(events: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not events:
        return None
    sorted_events = sorted(events, key=lambda e: (e["tweeted_at"], e["tweet_id"]))
    return sorted_events[0]


def update_picks(raw_path: Path, picks_path: Path, since_date: str) -> tuple[int, int]:
    raw = read_json(raw_path)
    picks = read_json(picks_path)
    if not isinstance(picks, list):
        raise RuntimeError(f"Expected array in {picks_path}")

    since = dt.date.fromisoformat(since_date)
    tweets = raw.get("tweets", [])
    usable_tweets: list[dict[str, Any]] = []
    for t in tweets:
        date_iso = parse_tweet_date(t.get("date"))
        if date_iso is None:
            continue
        if dt.date.fromisoformat(date_iso) < since:
            continue
        usable_tweets.append(
            {
                "tweet_id": str(t.get("id") or "").strip(),
                "tweet_url": str(t.get("url") or "").strip(),
                "tweeted_at": date_iso,
                "text": str(t.get("text") or ""),
                "quoted_text": str(t.get("quoted_text") or ""),
            }
        )

    updated = 0
    total_events = 0
    for pick in picks:
        ticker = str(pick.get("ticker") or "")
        name = str(pick.get("name") or "")
        if not ticker:
            continue

        pats = ticker_patterns(ticker)
        aliases = build_aliases(name)
        events = [
            {
                "tweet_id": t["tweet_id"],
                "tweet_url": t["tweet_url"],
                "tweeted_at": t["tweeted_at"],
            }
            for t in usable_tweets
            if t["tweet_id"] and t["tweet_url"] and matches_pick(t, pats, aliases)
        ]

        # Dedup by tweet_id
        dedup: dict[str, dict[str, Any]] = {e["tweet_id"]: e for e in events}
        final_events = sorted(
            dedup.values(), key=lambda e: (e["tweeted_at"], e["tweet_id"])
        )

        pick["tweet_events"] = final_events
        canonical = canonical_event(final_events)
        if canonical:
            pick["tweet_id"] = canonical["tweet_id"]
            pick["tweet_url"] = canonical["tweet_url"]
            pick["first_mentioned_at"] = canonical["tweeted_at"]
        updated += 1
        total_events += len(final_events)

    write_json(picks_path, picks)
    return updated, total_events


def main() -> int:
    parser = argparse.ArgumentParser(description="Link scraped tweets to picks.")
    parser.add_argument("--raw", type=Path, default=RAW_DEFAULT, help="raw-*.json path")
    parser.add_argument("--picks", type=Path, default=PICKS_PATH, help="picks.json path")
    parser.add_argument(
        "--since-date",
        default="2026-01-01",
        help="Only use tweets on/after this date (YYYY-MM-DD).",
    )
    args = parser.parse_args()

    if not args.raw.exists():
        print(f"ERROR: raw file not found: {args.raw}", file=sys.stderr)
        return 2
    if not args.picks.exists():
        print(f"ERROR: picks file not found: {args.picks}", file=sys.stderr)
        return 2

    updated, total_events = update_picks(args.raw, args.picks, args.since_date)
    print(
        f"[link] updated picks={updated} total_tweet_events={total_events} "
        f"raw={args.raw.name}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
