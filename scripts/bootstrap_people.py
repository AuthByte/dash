"""Create local person fixtures and optionally upsert into Supabase."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any

from common import DATA_DIR, load_env, write_json

PEOPLE_DIR = DATA_DIR / "people"

SHARED_THEMES = [
    {"slug": "photonics", "label": "Photonics/CPO", "accent": "#a78bfa", "sort_order": 1},
    {"slug": "neocloud", "label": "NeoCloud", "accent": "#60a5fa", "sort_order": 2},
    {"slug": "ai-semi", "label": "AI/Semi", "accent": "#34d399", "sort_order": 3},
    {"slug": "energy", "label": "Energy", "accent": "#fbbf24", "sort_order": 4},
    {"slug": "natsec", "label": "NatSec", "accent": "#f87171", "sort_order": 5},
    {"slug": "fintech", "label": "Fintech", "accent": "#22d3ee", "sort_order": 6},
    {"slug": "consumer", "label": "Consumer", "accent": "#fb923c", "sort_order": 7},
    {"slug": "crypto", "label": "Crypto", "accent": "#facc15", "sort_order": 8},
    {"slug": "macro", "label": "Macro", "accent": "#94a3b8", "sort_order": 9},
]

PEOPLE: list[dict[str, Any]] = [
    {
        "slug": "serenity",
        "name": "Serenity",
        "handle": "aleabitoreddit",
        "tagline": "Supply chain chokepoints • photonics/CPO • neocloud",
        "accent": "#f5a623",
        "active": True,
    },
    {
        "slug": "firstadopter",
        "name": "First Adopter",
        "handle": "firstadopter",
        "tagline": "Early public-market adoption • thematic inflections",
        "accent": "#7dd3fc",
        "active": True,
    },
    {
        "slug": "stocksavvyshay",
        "name": "Stock Savvy Shay",
        "handle": "stocksavvyshay",
        "tagline": "Catalyst hunting • retail-to-pro tape reading",
        "accent": "#f9a8d4",
        "active": True,
    },
    {
        "slug": "bourboncap",
        "name": "Bourbon Capital",
        "handle": "bourboncap",
        "tagline": "Concentrated quality • capital allocation",
        "accent": "#d4a574",
        "active": True,
    },
    {
        "slug": "mr-derivatives",
        "name": "Mr Derivatives",
        "handle": "mr_derivatives",
        "tagline": "Options flow • vol surfaces • positioning",
        "accent": "#a78bfa",
        "active": True,
    },
    {
        "slug": "micro2macr0",
        "name": "Micro2Macro",
        "handle": "micro2macr0",
        "tagline": "Bottom-up names with a top-down overlay",
        "accent": "#34d399",
        "active": True,
    },
    {
        "slug": "rjccapital",
        "name": "RJC Capital",
        "handle": "rjccapital",
        "tagline": "Public-market research • special situations",
        "accent": "#60a5fa",
        "active": True,
    },
    {
        "slug": "ckcapitalxx",
        "name": "CK Capital",
        "handle": "ckcapitalxx",
        "tagline": "High-conviction public book",
        "accent": "#fbbf24",
        "active": True,
    },
    {
        "slug": "theprofinvestor",
        "name": "The Prof Investor",
        "handle": "theprofinvestor",
        "tagline": "Process-driven long/short research",
        "accent": "#22d3ee",
        "active": True,
    },
    {
        "slug": "sixsigmacapital",
        "name": "Six Sigma Capital",
        "handle": "sixsigmacapital",
        "tagline": "Statistical edge • process discipline",
        "accent": "#fb923c",
        "active": True,
    },
    {
        "slug": "buccocapital",
        "name": "Bucco Capital",
        "handle": "buccocapital",
        "tagline": "Concentrated public equity",
        "accent": "#f87171",
        "active": True,
    },
    {
        "slug": "thelonginvest",
        "name": "The Long Invest",
        "handle": "thelonginvest",
        "tagline": "Long-duration compounding",
        "accent": "#94a3b8",
        "active": True,
    },
    {
        "slug": "labubu-trader",
        "name": "Labubu Trader",
        "handle": "labubu_trader",
        "tagline": "Tactical trading • momentum",
        "accent": "#facc15",
        "active": True,
    },
    {
        "slug": "cmsinvests",
        "name": "CMS Invests",
        "handle": "cmsinvests",
        "tagline": "Fundamental public-market investing",
        "accent": "#c084fc",
        "active": True,
    },
    {
        "slug": "globalflows",
        "name": "Global Flows",
        "handle": "globalflows",
        "tagline": "Cross-asset flows • macro tape",
        "accent": "#38bdf8",
        "active": True,
    },
    {
        "slug": "jbulltard1",
        "name": "J Bulltard",
        "handle": "jbulltard1",
        "tagline": "High-conviction directional calls",
        "accent": "#fb7185",
        "active": True,
    },
    {
        "slug": "zephyr-z9",
        "name": "Zephyr Z9",
        "handle": "zephyr_z9",
        "tagline": "Public-market research desk",
        "accent": "#67e8f9",
        "active": True,
    },
    {
        "slug": "amitisinvesting",
        "name": "Amitis Investing",
        "handle": "amitisinvesting",
        "tagline": "Fundamental investing commentary",
        "accent": "#86efac",
        "active": True,
    },
    {
        "slug": "kawzinvests",
        "name": "Kawz Invests",
        "handle": "KawzInvests",
        "tagline": "Public-market idea flow",
        "accent": "#fda4af",
        "active": True,
    },
]


def write_local_fixtures() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    catalog = [{**person, "sort_order": i} for i, person in enumerate(PEOPLE)]
    write_json(DATA_DIR / "people.json", catalog)
    today = dt.date.today().isoformat()
    for i, person in enumerate(PEOPLE):
        slug = person["slug"]
        pdir = PEOPLE_DIR / slug
        pdir.mkdir(parents=True, exist_ok=True)
        themes_path = pdir / "themes.json"
        if not themes_path.exists():
            write_json(themes_path, SHARED_THEMES)
        picks_path = pdir / "picks.json"
        if not picks_path.exists():
            write_json(picks_path, [])
        prices_path = pdir / "prices.json"
        if not prices_path.exists():
            write_json(prices_path, {})
        meta_path = pdir / "site_meta.json"
        if not meta_path.exists():
            write_json(
                meta_path,
                {
                    "handle": person["handle"],
                    "follower_count": 0,
                    "current_thesis_md": "",
                    "claimed_ytd_pct": 0,
                    "last_updated": today,
                },
            )
        print(f"[bootstrap] local {slug} sort={i}")
    print(f"[bootstrap] wrote {len(PEOPLE)} people to {DATA_DIR / 'people.json'}")


def upsert_supabase() -> int:
    from apply_digest import get_supabase_client

    client = get_supabase_client()
    people_rows = [
        {
            "slug": p["slug"],
            "name": p["name"],
            "handle": p["handle"],
            "tagline": p["tagline"],
            "accent": p["accent"],
            "active": True,
            "sort_order": i,
        }
        for i, p in enumerate(PEOPLE)
    ]
    client.upsert("people", people_rows, on_conflict="slug")
    print(f"[bootstrap] upserted {len(people_rows)} people rows")

    theme_rows: list[dict[str, Any]] = []
    meta_rows: list[dict[str, Any]] = []
    today = dt.date.today().isoformat()
    for person in PEOPLE:
        slug = person["slug"]
        for theme in SHARED_THEMES:
            theme_rows.append(
                {
                    "person_slug": slug,
                    "slug": theme["slug"],
                    "label": theme["label"],
                    "accent": theme["accent"],
                    "sort_order": theme["sort_order"],
                }
            )
        meta_path = PEOPLE_DIR / slug / "site_meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        meta_rows.append(
            {
                "person_slug": slug,
                "handle": person["handle"],
                "follower_count": meta.get("follower_count", 0),
                "current_thesis_md": meta.get("current_thesis_md", ""),
                "claimed_ytd_pct": meta.get("claimed_ytd_pct", 0),
                "last_updated": meta.get("last_updated", today),
            }
        )
    client.upsert("themes", theme_rows, on_conflict="person_slug,slug")
    client.upsert("site_meta", meta_rows, on_conflict="person_slug")
    print(f"[bootstrap] upserted themes={len(theme_rows)} site_meta={len(meta_rows)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap multi-profile fixtures.")
    parser.add_argument(
        "--supabase",
        action="store_true",
        help="Also upsert people/themes/site_meta into Supabase.",
    )
    args = parser.parse_args()
    load_env()
    write_local_fixtures()
    if args.supabase:
        try:
            return upsert_supabase()
        except Exception as err:
            print(f"[bootstrap] supabase upsert failed: {err}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
