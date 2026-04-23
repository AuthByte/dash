"""Apply latest digest output into Supabase (picks, tweet_events, site_meta)."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from common import OUTPUT_DIR, ROOT, load_env, read_json


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
        "first_mentioned_at": str(raw.get("first_mentioned_at", "")).strip() or None,
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
    matches = re.findall(r"\$([A-Za-z][A-Za-z0-9.\-]{0,19})", text or "")
    return {normalize_ticker(m) for m in matches if m}


def parse_tweeted_at(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        return dt.datetime.strptime(raw, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        pass
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
            "text": text or None,
        }
        for ticker in extract_tickers_from_text(text):
            bucket = out.setdefault(ticker, [])
            if all(existing["tweet_id"] != tweet_id for existing in bucket):
                bucket.append(event)
    return out


class SupabaseClient:
    """Tiny REST wrapper so we don't add a Python dep just for writes."""

    def __init__(self, url: str, key: str) -> None:
        self.base = url.rstrip("/") + "/rest/v1"
        self.key = key

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, *, params: dict[str, str] | None = None, body: Any | None = None, extra_headers: dict[str, str] | None = None) -> Any:
        from urllib.parse import urlencode
        url = f"{self.base}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, method=method, headers=self._headers(extra_headers), data=data)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            body_text = err.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Supabase {method} {path} failed ({err.code}): {body_text}"
            ) from err

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return self._request("GET", f"/{table}", params=params) or []

    def upsert(self, table: str, rows: list[dict[str, Any]], *, on_conflict: str) -> Any:
        if not rows:
            return []
        return self._request(
            "POST",
            f"/{table}",
            params={"on_conflict": on_conflict},
            body=rows,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )


def get_supabase_client() -> SupabaseClient:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    )
    if not url:
        raise RuntimeError("Missing SUPABASE_URL env var (put it in .env).")
    if not key:
        raise RuntimeError(
            "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY env var."
        )
    return SupabaseClient(url, key)


def merge_events(
    existing: list[dict[str, Any]], new_events: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for ev in existing + new_events:
        tweet_id = str(ev.get("tweet_id", "")).strip()
        if not tweet_id or tweet_id in seen:
            continue
        seen.add(tweet_id)
        merged.append(ev)
    merged.sort(
        key=lambda ev: (
            parse_tweeted_at(ev.get("tweeted_at")) or dt.datetime.max.replace(tzinfo=dt.timezone.utc),
            ev.get("tweet_id", ""),
        )
    )
    return merged


def apply_digest_for_person(person_slug: str, digest_path: Path) -> int:
    client = get_supabase_client()

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
    thesis_update = digest.get("thesis_update")
    if not incoming and not thesis_update:
        print("[apply-digest] no incoming picks or thesis update.")
        return 0

    existing_picks_rows = client.select(
        "picks",
        {
            "select": "ticker,first_mentioned_at,sort_order",
            "person_slug": f"eq.{person_slug}",
        },
    )
    existing_by_ticker = {row["ticker"]: row for row in existing_picks_rows}
    max_sort = max(
        (row.get("sort_order") or 0 for row in existing_picks_rows), default=-1
    )

    pick_upserts: list[dict[str, Any]] = []
    added = 0
    updated = 0
    skipped = 0
    for candidate in incoming:
        ticker = candidate["ticker"]
        if not ticker:
            skipped += 1
            continue
        existing = existing_by_ticker.get(ticker)
        if existing is None:
            max_sort += 1
            pick_upserts.append(
                {
                    "person_slug": person_slug,
                    "ticker": ticker,
                    "name": candidate["name"],
                    "theme": candidate["theme"],
                    "stance": candidate["stance"],
                    "conviction": candidate["conviction"],
                    "thesis_short": candidate["thesis_short"],
                    "thesis_long": candidate["thesis_long"],
                    "first_mentioned_at": candidate["first_mentioned_at"],
                    "tweet_url": candidate["tweet_url"],
                    "tweet_id": candidate["tweet_id"],
                    "exited_at": None,
                    "exit_price": None,
                    "sort_order": max_sort,
                }
            )
            added += 1
            continue
        # Only replace older first_mentioned_at with newer candidate date.
        existing_date = parse_iso_date(existing.get("first_mentioned_at"))
        candidate_date = parse_iso_date(candidate.get("first_mentioned_at"))
        should_replace = (
            existing_date is None
            or (candidate_date is not None and candidate_date >= existing_date)
        )
        if should_replace:
            pick_upserts.append(
                {
                    "person_slug": person_slug,
                    "ticker": ticker,
                    "name": candidate["name"],
                    "theme": candidate["theme"],
                    "stance": candidate["stance"],
                    "conviction": candidate["conviction"],
                    "thesis_short": candidate["thesis_short"],
                    "thesis_long": candidate["thesis_long"],
                    "first_mentioned_at": candidate["first_mentioned_at"]
                    or existing.get("first_mentioned_at"),
                    "tweet_url": candidate["tweet_url"],
                    "tweet_id": candidate["tweet_id"],
                    "sort_order": existing.get("sort_order") or 0,
                }
            )
            updated += 1
        else:
            skipped += 1

    if pick_upserts:
        client.upsert("picks", pick_upserts, on_conflict="person_slug,ticker")

    # Enrich tweet_events for every pick (existing + new) with matches from this scrape.
    all_ticker_rows = client.select(
        "picks",
        {
            "select": "ticker",
            "person_slug": f"eq.{person_slug}",
        },
    )
    all_tickers = [row["ticker"] for row in all_ticker_rows]

    event_rows: list[dict[str, Any]] = []
    for ticker in all_tickers:
        variants = ticker_variants_for_match(ticker)
        matched: list[dict[str, Any]] = []
        for variant in variants:
            matched.extend(tweet_index.get(variant, []))
        if not matched:
            continue
        # existing events for this (person, ticker)
        existing_events = client.select(
            "tweet_events",
            {
                "select": "tweet_id,tweeted_at,tweet_url,text",
                "person_slug": f"eq.{person_slug}",
                "ticker": f"eq.{ticker}",
            },
        )
        merged = merge_events(existing_events, matched)
        # Only upsert NEW events (existing already present).
        existing_ids = {ev["tweet_id"] for ev in existing_events}
        for ev in merged:
            if ev["tweet_id"] in existing_ids:
                continue
            event_rows.append(
                {
                    "person_slug": person_slug,
                    "ticker": ticker,
                    "tweet_id": ev["tweet_id"],
                    "tweeted_at": ev.get("tweeted_at") or None,
                    "tweet_url": ev.get("tweet_url") or "",
                    "text": ev.get("text"),
                }
            )

    if event_rows:
        client.upsert(
            "tweet_events", event_rows, on_conflict="person_slug,ticker,tweet_id"
        )

    if isinstance(thesis_update, str) and thesis_update.strip():
        client.upsert(
            "site_meta",
            [
                {
                    "person_slug": person_slug,
                    # keep existing handle/follower_count via postgrest merge-duplicates; only overwrite thesis+last_updated
                    "current_thesis_md": thesis_update.strip(),
                    "last_updated": dt.date.today().isoformat(),
                    # Required NOT NULLs. Read existing first so we don't clobber.
                    **_existing_site_meta_fields(client, person_slug),
                }
            ],
            on_conflict="person_slug",
        )

    print(
        f"[apply-digest] person={person_slug} added={added} updated={updated} "
        f"skipped={skipped} picks={len(all_tickers)} new_events={len(event_rows)}"
    )
    if isinstance(thesis_update, str) and thesis_update.strip():
        print("[apply-digest] site_meta thesis updated.")
    return 0


def _existing_site_meta_fields(client: SupabaseClient, person_slug: str) -> dict[str, Any]:
    rows = client.select(
        "site_meta",
        {
            "select": "handle,follower_count,claimed_ytd_pct",
            "person_slug": f"eq.{person_slug}",
        },
    )
    if not rows:
        return {"handle": "", "follower_count": 0, "claimed_ytd_pct": 0}
    row = rows[0]
    return {
        "handle": row.get("handle", ""),
        "follower_count": row.get("follower_count", 0),
        "claimed_ytd_pct": row.get("claimed_ytd_pct", 0),
    }


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Apply digest json into Supabase.")
    parser.add_argument(
        "--person",
        default="serenity",
        help="Person slug in public.people (e.g. serenity).",
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
