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


def person_output_dir(person_slug: str | None) -> Path:
    if not person_slug:
        return OUTPUT_DIR
    path = OUTPUT_DIR / person_slug
    path.mkdir(parents=True, exist_ok=True)
    return path


def cursor_path(person_slug: str | None = None) -> Path:
    if person_slug:
        return person_output_dir(person_slug) / ".cursor"
    return CURSOR_FILE


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


def read_cursor(person_slug: str | None = None) -> str | None:
    path = cursor_path(person_slug)
    if not path.exists():
        return None
    val = path.read_text().strip()
    return val or None


def write_cursor(tweet_id: str, person_slug: str | None = None) -> None:
    ensure_dirs()
    path = cursor_path(person_slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(tweet_id)


def get_handle() -> str:
    return os.environ.get("TWITTER_HANDLE", "aleabitoreddit")
