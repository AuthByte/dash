"""Ingest tweets for every active person using a free OpenRouter model."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from common import DATA_DIR, OUTPUT_DIR, load_env, write_json

SCRIPTS_DIR = Path(__file__).parent
DEFAULT_MODEL = "openai/gpt-oss-20b:free"


def load_people() -> list[dict]:
    path = DATA_DIR / "people.json"
    if not path.exists():
        return []
    people = json.loads(path.read_text())
    return [p for p in people if isinstance(p, dict) and p.get("active") is not False]


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape + digest every profile.")
    parser.add_argument("--skip-scrape", action="store_true")
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--only", default=None, help="Comma-separated slugs to ingest.")
    parser.add_argument("--max-tweets", type=int, default=60)
    parser.add_argument("--max-pages", type=int, default=20)
    args = parser.parse_args()
    load_env()

    people = load_people()
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        people = [p for p in people if p.get("slug") in wanted]

    if not people:
        print("ERROR: no people to ingest. Run scripts/bootstrap_people.py first.", file=sys.stderr)
        return 2

    failures = 0
    summary: list[dict] = []
    for person in people:
        slug = person["slug"]
        handle = person["handle"]
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "run.py"),
            "--person",
            slug,
            "--handle",
            handle,
            "--model",
            args.model,
            "--max-tweets",
            str(args.max_tweets),
            "--max-pages",
            str(args.max_pages),
        ]
        if args.skip_scrape:
            cmd.append("--skip-scrape")
        if args.full:
            cmd.append("--full")
        print(f"\n######## ingest {slug} @{handle} ########")
        rc = subprocess.run(cmd, cwd=SCRIPTS_DIR.parent).returncode
        summary.append(
            {
                "slug": slug,
                "handle": handle,
                "ok": rc == 0,
                "exit_code": rc,
            }
        )
        if rc != 0:
            print(f"[ingest] {slug} failed with exit {rc}", file=sys.stderr)
            failures += 1
    print(f"\n[ingest] done people={len(people)} failures={failures}")
    report = {
        "people": len(people),
        "failures": failures,
        "ok": failures == 0,
        "results": summary,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT_DIR / "ingest-summary.json", report)
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
