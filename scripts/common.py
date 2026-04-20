"""Shared paths and helpers for the scrape/digest pipeline."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "scrape-output"
CURSOR_FILE = OUTPUT_DIR / ".cursor"


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_env() -> None:
    """Load .env if python-dotenv is available; silent no-op otherwise."""
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(ROOT / ".env")
    except ImportError:
        pass


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_cursor() -> str | None:
    if not CURSOR_FILE.exists():
        return None
    val = CURSOR_FILE.read_text().strip()
    return val or None


def write_cursor(tweet_id: str) -> None:
    ensure_dirs()
    CURSOR_FILE.write_text(tweet_id)


def get_handle() -> str:
    return os.environ.get("TWITTER_HANDLE", "aleabitoreddit")
