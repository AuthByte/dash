"""Send raw tweets + existing picks context to OpenRouter and parse into structured picks."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

from apply_digest import SupabaseClient, get_supabase_client
from common import (
    OUTPUT_DIR,
    ensure_dirs,
    get_handle,
    load_env,
    read_json,
    write_json,
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "anthropic/claude-3.5-sonnet"
PROMPT_PATH = Path(__file__).parent / "prompts" / "digest_system.md"


THEME_ENUM = [
    "photonics",
    "neocloud",
    "ai-semi",
    "energy",
    "natsec",
    "fintech",
    "consumer",
    "crypto",
    "macro",
]
STANCE_ENUM = ["long", "neutral", "bearish", "exited"]
CONVICTION_ENUM = ["high", "medium", "low"]


def pick_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "ticker",
            "name",
            "theme",
            "stance",
            "conviction",
            "thesis_short",
            "thesis_long",
            "first_mentioned_at",
            "tweet_url",
            "tweet_id",
        ],
        "properties": {
            "ticker": {"type": "string"},
            "name": {"type": "string"},
            "theme": {"type": "string", "enum": THEME_ENUM},
            "stance": {"type": "string", "enum": STANCE_ENUM},
            "conviction": {"type": "string", "enum": CONVICTION_ENUM},
            "thesis_short": {"type": "string", "maxLength": 160},
            "thesis_long": {"type": "string"},
            "first_mentioned_at": {
                "type": "string",
                "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
            },
            "tweet_url": {"type": "string"},
            "tweet_id": {"type": "string"},
        },
    }


def response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["new_picks", "updated_picks", "thesis_update", "ignored"],
        "properties": {
            "new_picks": {"type": "array", "items": pick_schema()},
            "updated_picks": {"type": "array", "items": pick_schema()},
            "thesis_update": {"type": ["string", "null"]},
            "ignored": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["tweet_id", "reason"],
                    "properties": {
                        "tweet_id": {"type": "string"},
                        "reason": {"type": "string"},
                    },
                },
            },
        },
    }


def load_system_prompt(handle: str) -> str:
    return PROMPT_PATH.read_text().replace("{HANDLE}", handle)


def existing_pick_summaries(person_slug: str = "serenity") -> list[dict[str, Any]]:
    """Slim view of Supabase picks to stuff into the LLM context for dedupe."""
    try:
        client: SupabaseClient = get_supabase_client()
    except RuntimeError as err:
        print(f"[digest] warning: {err}; continuing with empty dedupe context.")
        return []
    rows = client.select(
        "picks",
        {
            "select": "ticker,name,theme,stance,conviction,first_mentioned_at",
            "person_slug": f"eq.{person_slug}",
        },
    )
    return [
        {
            "ticker": row["ticker"],
            "name": row.get("name", ""),
            "theme": row.get("theme", ""),
            "stance": row.get("stance", ""),
            "conviction": row.get("conviction", ""),
            "first_mentioned_at": row.get("first_mentioned_at"),
        }
        for row in rows
    ]


def call_openrouter(
    api_key: str,
    model: str,
    system: str,
    user: dict[str, Any],
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/serenity-picks",
        "X-Title": "Serenity Picks Digest",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "digest_output",
                "strict": True,
                "schema": response_schema(),
            },
        },
        "temperature": 0.2,
    }
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(OPENROUTER_URL, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"unexpected OpenRouter response: {data}") from exc
    if isinstance(content, list):
        # Some models return content blocks; concat the text parts.
        content = "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    return json.loads(content)


def find_latest_raw() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    candidates = sorted(OUTPUT_DIR.glob("raw-*.json"))
    return candidates[-1] if candidates else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Digest raw tweets via OpenRouter.")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Path to raw-*.json (defaults to latest in scrape-output).",
    )
    parser.add_argument("--model", default=None, help="Override OPENROUTER_MODEL.")
    parser.add_argument(
        "--max-tweets",
        type=int,
        default=80,
        help="Cap tweets per request to keep token cost in check.",
    )
    args = parser.parse_args()

    load_env()
    ensure_dirs()

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print(
            "ERROR: OPENROUTER_API_KEY not set. Copy .env.example to .env and fill it in.",
            file=sys.stderr,
        )
        return 2

    raw_path = args.input or find_latest_raw()
    if not raw_path or not raw_path.exists():
        print("ERROR: no raw scrape file found. Run scripts/scrape.py first.", file=sys.stderr)
        return 2

    raw = read_json(raw_path)
    tweets = raw.get("tweets", [])
    if not tweets:
        print(f"[digest] {raw_path.name} contains 0 tweets, nothing to do.")
        return 1

    if len(tweets) > args.max_tweets:
        print(
            f"[digest] capping {len(tweets)} tweets to most recent {args.max_tweets}."
        )
        tweets = tweets[-args.max_tweets :]

    handle = raw.get("handle") or get_handle()
    model = args.model or os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODEL

    user_payload = {
        "handle": handle,
        "existing_picks": existing_pick_summaries(),
        "tweets": tweets,
    }

    print(f"[digest] model={model}  tweets={len(tweets)}  raw={raw_path.name}")
    result = call_openrouter(api_key, model, load_system_prompt(handle), user_payload)

    today = dt.date.today().isoformat()
    out_path = OUTPUT_DIR / f"digest-{today}.json"
    write_json(out_path, result)

    summary = (
        f"[digest] new={len(result.get('new_picks', []))}  "
        f"updated={len(result.get('updated_picks', []))}  "
        f"thesis_update={'yes' if result.get('thesis_update') else 'no'}  "
        f"ignored={len(result.get('ignored', []))}"
    )
    print(summary)
    print(f"[digest] wrote {out_path.relative_to(OUTPUT_DIR.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
