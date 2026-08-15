"""Download X profile photos for every desk into public/avatars."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from common import DATA_DIR, ROOT, load_env

AVATAR_DIR = ROOT / "public" / "avatars"
UNAVATAR = "https://unavatar.io/x/{handle}?fallback=false"


def load_people() -> list[dict]:
    path = DATA_DIR / "people.json"
    if not path.exists():
        return []
    rows = json.loads(path.read_text())
    return [p for p in rows if isinstance(p, dict) and p.get("active") is not False]


def download(handle: str, dest: Path) -> bool:
    url = UNAVATAR.format(handle=handle.lstrip("@"))
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; picks-tracker-avatars/1.0)",
            "Accept": "image/jpeg,image/png,image/webp,image/*;q=0.8",
        },
    )
    try:
        with urlopen(req, timeout=20) as resp:
            data = resp.read()
            ctype = (resp.headers.get("content-type") or "").lower()
    except (HTTPError, URLError, TimeoutError) as err:
        print(f"[avatars] fail @{handle}: {err}", file=sys.stderr)
        return False
    if not data or "html" in ctype:
        print(f"[avatars] empty/html @{handle} ({ctype})", file=sys.stderr)
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print(f"[avatars] wrote {dest.relative_to(ROOT)} ({len(data)} bytes)")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch X PFPs into public/avatars.")
    parser.add_argument("--only", default=None, help="Comma-separated slugs.")
    args = parser.parse_args()
    load_env()
    people = load_people()
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        people = [p for p in people if p.get("slug") in wanted]
    if not people:
        print("ERROR: no people. Run scripts/bootstrap_people.py first.", file=sys.stderr)
        return 2

    ok = 0
    for i, person in enumerate(people):
        slug = str(person["slug"])
        handle = str(person["handle"])
        dest = AVATAR_DIR / f"{slug}.jpg"
        if download(handle, dest):
            ok += 1
        if i + 1 < len(people):
            time.sleep(0.35)
    print(f"[avatars] done {ok}/{len(people)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
