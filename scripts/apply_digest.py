"""Apply latest digest output into data/people/<person>/ files."""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from typing import Any

from common import OUTPUT_DIR, ROOT, read_json, write_json


def latest_digest_path() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    candidates = sorted(OUTPUT_DIR.glob("digest-*.json"))
    return candidates[-1] if candidates else None


def normalize_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    aliases = {
        "RPI.L": "RPI",
        "HPS-A.TO": "HPS.A.TO",
        "HPS.A": "HPS.A.TO",
        "SIVE": "SIVE.ST",
        "SIVE.PA": "SIVE.ST",
    }
    return aliases.get(t, t)


def parse_iso_date(value: str | None) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value[:10])
    except ValueError:
        return None


def canonical_new_pick(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticker": normalize_ticker(str(raw.get("ticker", "")).strip()),
        "name": str(raw.get("name", "")).strip(),
        "theme": str(raw.get("theme", "")).strip(),
        "stance": str(raw.get("stance", "")).strip(),
        "conviction": str(raw.get("conviction", "")).strip(),
        "thesis_short": str(raw.get("thesis_short", "")).strip(),
        "thesis_long": str(raw.get("thesis_long", "")).strip(),
        "first_mentioned_at": str(raw.get("first_mentioned_at", "")).strip(),
        "tweet_url": str(raw.get("tweet_url", "")).strip(),
        "tweet_id": str(raw.get("tweet_id", "")).strip(),
        "exited_at": None,
        "exit_price": None,
    }


def ticker_variants_for_match(ticker: str) -> set[str]:
    canonical = normalize_ticker(ticker)
    variants = {canonical}
    for alt, normalized in {
        "RPI.L": "RPI",
        "HPS-A.TO": "HPS.A.TO",
        "HPS.A": "HPS.A.TO",
        "SIVE": "SIVE.ST",
        "SIVE.PA": "SIVE.ST",
    }.items():
        if normalized == canonical:
            variants.add(alt)
    return variants


def extract_tickers_from_text(text: str) -> set[str]:
    # Capture cashtags with common exchange suffixes or separators.
    matches = re.findall(r"\$([A-Za-z][A-Za-z0-9.\-]{0,19})", text or "")
    return {normalize_ticker(m) for m in matches if m}


def parse_tweeted_at(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    # Scrape format from X.
    try:
        return dt.datetime.strptime(raw, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        pass
    # ISO-like timestamps.
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = dt.datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=dt.timezone.utc)
        return parsed
    except ValueError:
        return None


def to_event_date(value: str | None) -> str | None:
    parsed = parse_tweeted_at(value)
    if not parsed:
        return None
    return parsed.date().isoformat()


def build_tweet_event_index(raw_tweets: list[dict[str, Any]]) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    for tweet in raw_tweets:
        tweet_id = str(tweet.get("id", "")).strip()
        tweeted_at_raw = str(tweet.get("date", "")).strip()
        tweeted_at_dt = parse_tweeted_at(tweeted_at_raw)
        tweeted_at = tweeted_at_dt.isoformat() if tweeted_at_dt else tweeted_at_raw
        tweet_url = str(tweet.get("url", "")).strip()
        text = str(tweet.get("text", ""))
        if not tweet_id or not tweet_url:
            continue
        event = {
            "tweet_id": tweet_id,
            "tweeted_at": tweeted_at,
            "tweet_url": tweet_url,
        }
        for ticker in extract_tickers_from_text(text):
            bucket = out.setdefault(ticker, [])
            if all(existing["tweet_id"] != tweet_id for existing in bucket):
                bucket.append(event)
    return out


def merge_tweet_events(existing_events: list[dict[str, Any]], new_events: list[dict[str, Any]]) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    seen: set[str] = set()
    for event in existing_events + new_events:
        tweet_id = str(event.get("tweet_id", "")).strip()
        tweet_url = str(event.get("tweet_url", "")).strip()
        tweeted_at = str(event.get("tweeted_at", "")).strip()
        if not tweet_id or not tweet_url or tweet_id in seen:
            continue
        seen.add(tweet_id)
        merged.append(
            {
                "tweet_id": tweet_id,
                "tweet_url": tweet_url,
                "tweeted_at": tweeted_at,
            }
        )
    merged.sort(
        key=lambda event: (
            parse_tweeted_at(event.get("tweeted_at")) or dt.datetime.max.replace(tzinfo=dt.timezone.utc),
            event.get("tweet_id", ""),
        )
    )
    return merged


def should_replace(existing: dict[str, Any], candidate: dict[str, Any]) -> bool:
    existing_date = parse_iso_date(existing.get("first_mentioned_at"))
    candidate_date = parse_iso_date(candidate.get("first_mentioned_at"))
    if existing_date is None and candidate_date is None:
        return False
    if existing_date is None:
        return True
    if candidate_date is None:
        return False
    return candidate_date >= existing_date


def apply_event_fields(pick: dict[str, Any], events: list[dict[str, str]]) -> dict[str, Any]:
    if not events:
        return pick
    out = dict(pick)
    out["tweet_events"] = events
    out["tweet_url"] = events[0]["tweet_url"]
    out["tweet_id"] = events[0]["tweet_id"]
    first_mentioned = to_event_date(events[0].get("tweeted_at"))
    if first_mentioned:
        out["first_mentioned_at"] = first_mentioned
    return out


def apply_digest_for_person(person_slug: str, digest_path: Path) -> int:
    person_dir = ROOT / "data" / "people" / person_slug
    picks_path = person_dir / "picks.json"
    site_meta_path = person_dir / "site_meta.json"
    if not picks_path.exists():
        print(f"ERROR: picks file not found: {picks_path}", file=sys.stderr)
        return 2
    if not site_meta_path.exists():
        print(f"ERROR: site meta file not found: {site_meta_path}", file=sys.stderr)
        return 2

    picks = read_json(picks_path)
    digest = read_json(digest_path)
    source_file = str(digest.get("source_file", "")).strip()
    raw_path: Path | None = None
    if source_file:
        candidate = OUTPUT_DIR / source_file.replace("digest-", "raw-")
        if candidate.exists():
            raw_path = candidate
    if raw_path is None:
        latest_raw = sorted(OUTPUT_DIR.glob("raw-*.json"))
        if latest_raw:
            raw_path = latest_raw[-1]
    raw_tweets = read_json(raw_path).get("tweets", []) if raw_path and raw_path.exists() else []
    tweet_index = build_tweet_event_index(raw_tweets)
    digest_new = [canonical_new_pick(p) for p in digest.get("new_picks", [])]
    digest_updated = [canonical_new_pick(p) for p in digest.get("updated_picks", [])]
    incoming = digest_new + digest_updated
    if not incoming and not digest.get("thesis_update"):
        print("[apply-digest] no incoming picks or thesis update.")
        return 0

    index_by_ticker: dict[str, int] = {}
    for idx, pick in enumerate(picks):
        index_by_ticker[normalize_ticker(str(pick.get("ticker", "")))] = idx

    added = 0
    updated = 0
    skipped = 0
    for candidate in incoming:
        ticker = candidate["ticker"]
        if not ticker:
            skipped += 1
            continue
        existing_idx = index_by_ticker.get(ticker)
        if existing_idx is None:
            variants = ticker_variants_for_match(ticker)
            matched_events: list[dict[str, str]] = []
            for variant in variants:
                matched_events.extend(tweet_index.get(variant, []))
            matched_events = merge_tweet_events([], matched_events)
            candidate = apply_event_fields(candidate, matched_events)
            picks.append(candidate)
            index_by_ticker[ticker] = len(picks) - 1
            added += 1
            continue
        existing = picks[existing_idx]
        variants = ticker_variants_for_match(ticker)
        matched_events = []
        for variant in variants:
            matched_events.extend(tweet_index.get(variant, []))
        merged_events = merge_tweet_events(existing.get("tweet_events", []), matched_events)
        if should_replace(existing, candidate):
            candidate_with_events = apply_event_fields(candidate, merged_events)
            picks[existing_idx] = {**existing, **candidate_with_events}
            updated += 1
        else:
            picks[existing_idx] = apply_event_fields(existing, merged_events)
            skipped += 1

    # Enrich all existing picks with all matched tweet events from this scrape.
    for idx, pick in enumerate(picks):
        variants = ticker_variants_for_match(str(pick.get("ticker", "")))
        matched_events: list[dict[str, Any]] = []
        for variant in variants:
            matched_events.extend(tweet_index.get(variant, []))
        merged_events = merge_tweet_events(pick.get("tweet_events", []), matched_events)
        picks[idx] = apply_event_fields(pick, merged_events)

    site_meta = read_json(site_meta_path)
    thesis_update = digest.get("thesis_update")
    if isinstance(thesis_update, str) and thesis_update.strip():
        site_meta["current_thesis_md"] = thesis_update.strip()
        site_meta["last_updated"] = dt.date.today().isoformat()

    write_json(picks_path, picks)
    write_json(site_meta_path, site_meta)

    print(
        f"[apply-digest] person={person_slug} added={added} updated={updated} "
        f"skipped={skipped} picks={len(picks)}"
    )
    if isinstance(thesis_update, str) and thesis_update.strip():
        print("[apply-digest] site_meta thesis updated.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply digest json into person data files.")
    parser.add_argument(
        "--person",
        default="serenity",
        help="Person slug under data/people/<slug>/.",
    )
    parser.add_argument(
        "--digest",
        type=Path,
        default=None,
        help="Digest file path (defaults to latest scrape-output/digest-*.json).",
    )
    args = parser.parse_args()

    digest_path = args.digest or latest_digest_path()
    if not digest_path or not digest_path.exists():
        print("ERROR: no digest file found to apply.", file=sys.stderr)
        return 2
    return apply_digest_for_person(args.person, digest_path)


if __name__ == "__main__":
    sys.exit(main())
