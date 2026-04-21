"""Apply latest digest output into data/people/<person>/ files."""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from typing import Any

from common import ROOT, OUTPUT_DIR, read_json, write_json


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
            picks.append(candidate)
            index_by_ticker[ticker] = len(picks) - 1
            added += 1
            continue
        existing = picks[existing_idx]
        if should_replace(existing, candidate):
            # Preserve any historical tweet_events when replacing base pick.
            if existing.get("tweet_events") and not candidate.get("tweet_events"):
                candidate["tweet_events"] = existing["tweet_events"]
            picks[existing_idx] = {**existing, **candidate}
            updated += 1
        else:
            skipped += 1

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
