"""End-to-end: scrape -> digest -> print Cursor handoff block."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from common import OUTPUT_DIR, load_env, read_json

SCRIPTS_DIR = Path(__file__).parent


def run_step(name: str, cmd: list[str]) -> int:
    print(f"\n=== {name} ===")
    proc = subprocess.run(cmd, cwd=SCRIPTS_DIR.parent)
    return proc.returncode


def latest_digest() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    candidates = sorted(OUTPUT_DIR.glob("digest-*.json"))
    return candidates[-1] if candidates else None


def print_summary(result: dict) -> None:
    new = result.get("new_picks", [])
    updated = result.get("updated_picks", [])
    thesis = result.get("thesis_update")
    ignored = result.get("ignored", [])

    print("\n--- Summary ---")
    print(f"  New picks      : {len(new)}")
    for p in new:
        print(f"    + {p['ticker']:<10} {p['stance']:<8} {p['conviction']:<6} {p['theme']}")
    print(f"  Updated picks  : {len(updated)}")
    for p in updated:
        print(f"    ~ {p['ticker']:<10} {p['stance']:<8} {p['conviction']:<6} {p['theme']}")
    print(f"  Thesis update  : {'yes' if thesis else 'no'}")
    print(f"  Ignored        : {len(ignored)}")


def print_cursor_block(digest_path: Path, result: dict) -> None:
    payload = {
        "source_file": str(digest_path.name),
        "new_picks": result.get("new_picks", []),
        "updated_picks": result.get("updated_picks", []),
        "thesis_update": result.get("thesis_update"),
    }
    body = json.dumps(payload, indent=2, ensure_ascii=False)

    print("\n" + "=" * 64)
    print("=== PASTE THIS TO CURSOR ===")
    print("=" * 64)
    print()
    print(
        "Hey Cursor — here is the latest digest from `python scripts/run.py`. "
        "Please merge into `data/picks.json` (and `data/site_meta.json` if "
        "`thesis_update` is non-null), keeping the existing pick order for "
        "untouched entries and appending new picks at the end. Run the build "
        "to validate before reporting back."
    )
    print()
    print("```json")
    print(body)
    print("```")
    print()
    print("=" * 64)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run scrape + digest pipeline.")
    parser.add_argument("--skip-scrape", action="store_true", help="Reuse latest raw-*.json")
    parser.add_argument("--full", action="store_true", help="Forward --full to scrape")
    parser.add_argument("--model", default=None, help="Forward --model to digest")
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
    args = parser.parse_args()

    load_env()

    if not args.skip_scrape:
        scrape_cmd = [sys.executable, str(SCRIPTS_DIR / "scrape.py")]
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

    digest_cmd = [sys.executable, str(SCRIPTS_DIR / "digest.py")]
    if args.model:
        digest_cmd += ["--model", args.model]
    rc = run_step("digest", digest_cmd)
    if rc != 0:
        print(f"\n[run] digest failed (exit {rc}).", file=sys.stderr)
        return rc

    digest_path = latest_digest()
    if not digest_path:
        print("\n[run] no digest file produced — strange. Check logs above.", file=sys.stderr)
        return 2

    result = read_json(digest_path)
    print_summary(result)
    print_cursor_block(digest_path, result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
