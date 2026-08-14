"""End-to-end: scrape -> digest -> apply (local + optional Supabase)."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from apply_digest import apply_digest_for_person
from common import OUTPUT_DIR, load_env, person_output_dir, read_json

SCRIPTS_DIR = Path(__file__).parent


def run_step(name: str, cmd: list[str]) -> int:
    print(f"\n=== {name} ===")
    proc = subprocess.run(cmd, cwd=SCRIPTS_DIR.parent)
    return proc.returncode


def latest_digest(person_slug: str | None) -> Path | None:
    search = []
    if person_slug:
        search.append(person_output_dir(person_slug))
    search.append(OUTPUT_DIR)
    for directory in search:
        if not directory.exists():
            continue
        candidates = sorted(directory.glob("digest-*.json"))
        if candidates:
            return candidates[-1]
    return None


def print_summary(result: dict) -> None:
    new = result.get("new_picks", [])
    updated = result.get("updated_picks", [])
    thesis = result.get("thesis_update")
    ignored = result.get("ignored", [])

    print("\n--- Summary ---")
    print(f"  Model          : {result.get('_model', '(unknown)')}")
    print(f"  New picks      : {len(new)}")
    for p in new:
        print(f"    + {p['ticker']:<10} {p['stance']:<8} {p['conviction']:<6} {p['theme']}")
    print(f"  Updated picks  : {len(updated)}")
    for p in updated:
        print(f"    ~ {p['ticker']:<10} {p['stance']:<8} {p['conviction']:<6} {p['theme']}")
    print(f"  Thesis update  : {'yes' if thesis else 'no'}")
    print(f"  Ignored        : {len(ignored)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run scrape + digest pipeline.")
    parser.add_argument("--skip-scrape", action="store_true", help="Reuse latest raw-*.json")
    parser.add_argument("--full", action="store_true", help="Forward --full to scrape")
    parser.add_argument("--model", default=None, help="Forward --model to digest")
    parser.add_argument("--handle", default=None, help="Twitter handle without @")
    parser.add_argument(
        "--person",
        default=None,
        help="Person slug under data/people/<slug>/ (default: SCRAPE_PERSON_SLUG or serenity).",
    )
    parser.add_argument(
        "--skip-apply",
        action="store_true",
        help="Do not merge digest into local/Supabase data.",
    )
    parser.add_argument(
        "--since-date",
        default="2026-01-01",
        help="Forward --since-date to scrape (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=80,
        help="Forward --max-pages to scrape pagination.",
    )
    parser.add_argument(
        "--max-tweets",
        type=int,
        default=80,
        help="Forward --max-tweets to digest.",
    )
    args = parser.parse_args()

    load_env()
    person_slug = (args.person or os.environ.get("SCRAPE_PERSON_SLUG") or "serenity").strip()

    if not args.skip_scrape:
        scrape_cmd = [sys.executable, str(SCRIPTS_DIR / "scrape.py"), "--person", person_slug]
        if args.handle:
            scrape_cmd += ["--handle", args.handle]
        if args.full:
            scrape_cmd.append("--full")
        if args.since_date:
            scrape_cmd += ["--since-date", args.since_date]
        if args.max_pages:
            scrape_cmd += ["--max-pages", str(args.max_pages)]
        rc = run_step("scrape", scrape_cmd)
        if rc == 1:
            print("\n[run] no new tweets — exiting cleanly.")
            return 0
        if rc != 0:
            print(f"\n[run] scrape failed (exit {rc}). Aborting.", file=sys.stderr)
            return rc

    digest_cmd = [
        sys.executable,
        str(SCRIPTS_DIR / "digest.py"),
        "--person",
        person_slug,
        "--max-tweets",
        str(args.max_tweets),
    ]
    if args.model:
        digest_cmd += ["--model", args.model]
    rc = run_step("digest", digest_cmd)
    if rc != 0:
        print(f"\n[run] digest failed (exit {rc}).", file=sys.stderr)
        return rc

    digest_path = latest_digest(person_slug)
    if not digest_path:
        print("\n[run] no digest file produced — strange. Check logs above.", file=sys.stderr)
        return 2

    result = read_json(digest_path)
    print_summary(result)

    if not args.skip_apply:
        apply_rc = apply_digest_for_person(person_slug, digest_path)
        if apply_rc != 0:
            return apply_rc

    return 0


if __name__ == "__main__":
    sys.exit(main())
