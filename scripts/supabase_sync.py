"""Push merged person data (picks, tweet_events, site_meta) to Supabase after scrape/apply."""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from numbers import Real
from typing import Any

from common import ROOT, read_json


def is_supabase_configured() -> bool:
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    return bool(url and key)


def _client():
    from supabase import create_client

    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    return create_client(url, key)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def push_person_to_supabase(person_slug: str) -> int:
    """Upsert picks + site_meta; replace tweet_events for this person."""
    if not is_supabase_configured():
        print("[supabase-sync] skipped (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)")
        return 0

    person_dir = ROOT / "data" / "people" / person_slug
    picks_path = person_dir / "picks.json"
    site_meta_path = person_dir / "site_meta.json"
    if not picks_path.exists():
        print(f"[supabase-sync] ERROR: missing {picks_path}", file=sys.stderr)
        return 2
    if not site_meta_path.exists():
        print(f"[supabase-sync] ERROR: missing {site_meta_path}", file=sys.stderr)
        return 2

    picks: list[dict[str, Any]] = read_json(picks_path)
    site_meta: dict[str, Any] = read_json(site_meta_path)

    try:
        client = _client()
    except Exception as exc:
        print(f"[supabase-sync] client error: {exc}", file=sys.stderr)
        return 3

    ts = _now_iso()

    pick_rows: list[dict[str, Any]] = []
    for i, p in enumerate(picks):
        ticker = str(p.get("ticker", "")).strip()
        if not ticker:
            continue
        exited = p.get("exited_at")
        exit_px = p.get("exit_price")
        pick_rows.append(
            {
                "person_slug": person_slug,
                "ticker": ticker,
                "name": str(p.get("name", "")),
                "theme": str(p.get("theme", "")),
                "stance": str(p.get("stance", "")),
                "conviction": str(p.get("conviction", "")),
                "thesis_short": str(p.get("thesis_short", "")),
                "thesis_long": str(p.get("thesis_long", "")),
                "first_mentioned_at": str(p.get("first_mentioned_at", ""))[:10] or None,
                "tweet_url": str(p.get("tweet_url", "")) or None,
                "tweet_id": str(p.get("tweet_id", "")) or None,
                "exited_at": (str(exited)[:10] if exited else None),
                "exit_price": float(exit_px)
                if isinstance(exit_px, Real) and not isinstance(exit_px, bool)
                else None,
                "sort_order": i,
                "updated_at": ts,
            }
        )

    if not pick_rows:
        print("[supabase-sync] ERROR: no valid picks to sync", file=sys.stderr)
        return 2

    try:
        client.table("picks").upsert(pick_rows, on_conflict="person_slug,ticker").execute()
    except Exception as exc:
        print(f"[supabase-sync] picks upsert error: {exc}", file=sys.stderr)
        return 3

    # Replace tweet_events for this person from picks (source of truth).
    try:
        client.table("tweet_events").delete().eq("person_slug", person_slug).execute()
    except Exception as exc:
        print(f"[supabase-sync] tweet_events delete error: {exc}", file=sys.stderr)
        return 3

    event_rows: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    for p in picks:
        ticker = str(p.get("ticker", "")).strip()
        if not ticker:
            continue
        for ev in p.get("tweet_events") or []:
            if not isinstance(ev, dict):
                continue
            tid = str(ev.get("tweet_id", "")).strip()
            if not tid:
                continue
            dedupe = (ticker, tid)
            if dedupe in seen_keys:
                continue
            seen_keys.add(dedupe)
            tweeted = str(ev.get("tweeted_at", "")).strip()
            event_rows.append(
                {
                    "person_slug": person_slug,
                    "ticker": ticker,
                    "tweet_id": tid,
                    "tweeted_at": tweeted or None,
                    "tweet_url": str(ev.get("tweet_url", "")).strip() or None,
                    "text": str(ev.get("text", "")).strip() or None,
                }
            )

    if event_rows:
        try:
            client.table("tweet_events").insert(event_rows).execute()
        except Exception as exc:
            print(f"[supabase-sync] tweet_events insert error: {exc}", file=sys.stderr)
            return 3

    meta_row = {
        "person_slug": person_slug,
        "handle": str(site_meta.get("handle", "")),
        "follower_count": int(site_meta.get("follower_count", 0) or 0),
        "current_thesis_md": str(site_meta.get("current_thesis_md", "")),
        "claimed_ytd_pct": float(site_meta.get("claimed_ytd_pct", 0) or 0),
        "last_updated": str(site_meta.get("last_updated", ""))[:10] or None,
    }
    try:
        client.table("site_meta").upsert(meta_row, on_conflict="person_slug").execute()
    except Exception as exc:
        print(f"[supabase-sync] site_meta upsert error: {exc}", file=sys.stderr)
        return 3

    print(
        f"[supabase-sync] person={person_slug} picks={len(pick_rows)} "
        f"tweet_events={len(event_rows)} site_meta=ok"
    )
    return 0


def main() -> int:
    import argparse

    from common import load_env

    parser = argparse.ArgumentParser(description="Push data/people/<slug>/* to Supabase.")
    parser.add_argument(
        "--person",
        default=os.environ.get("SCRAPE_PERSON_SLUG", "serenity"),
        help="Person slug under data/people/<slug>/.",
    )
    args = parser.parse_args()
    load_env()
    return push_person_to_supabase(args.person)


if __name__ == "__main__":
    sys.exit(main())
