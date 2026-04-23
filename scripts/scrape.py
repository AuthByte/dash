"""Fetch latest tweets from a target user via X's public GraphQL endpoints.

Uses cookie-session auth (the same `auth_token` + `ct0` cookies your browser
holds after a normal login) plus the well-known public web bearer token. No
third-party scraper library needed -- this avoids the chronic upstream breakage
of libraries like twikit/twscrape when X rotates its frontend.

One-time setup:
    1. Log into x.com in any browser with a throwaway account.
    2. DevTools -> Application -> Cookies -> https://x.com
    3. Copy the values of `auth_token` and `ct0`.
    4. Paste into .env as X_AUTH_TOKEN and X_CT0.

Then:
    python scripts/scrape.py
"""
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

from common import (
    OUTPUT_DIR,
    ensure_dirs,
    get_handle,
    load_env,
    read_cursor,
    write_cursor,
    write_json,
)


SETUP_HINT = (
    "See README.md -> 'Cookie setup' for how to grab `auth_token` and `ct0` "
    "from your browser's DevTools."
)

# Public bearer token X embeds in their own webapp. Stable for years; rotates
# rarely. If a request starts 401-ing despite valid cookies, refresh this from
# any logged-out devtools network tab on x.com.
PUBLIC_BEARER = (
    "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D"
    "1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

USER_BY_SCREEN_NAME_URL = (
    "https://x.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName"
)
USER_TWEETS_URL = "https://x.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets"
MAX_TWEETS_PER_PAGE = 100


def require_cookies() -> dict[str, str]:
    auth_token = os.environ.get("X_AUTH_TOKEN", "").strip()
    ct0 = os.environ.get("X_CT0", "").strip()
    missing = [k for k, v in [("X_AUTH_TOKEN", auth_token), ("X_CT0", ct0)] if not v]
    if missing:
        print(
            f"ERROR: missing env var(s): {', '.join(missing)}.\n  {SETUP_HINT}",
            file=sys.stderr,
        )
        sys.exit(2)
    return {"auth_token": auth_token, "ct0": ct0}


def build_headers(ct0: str) -> dict[str, str]:
    return {
        "authorization": f"Bearer {PUBLIC_BEARER}",
        "x-csrf-token": ct0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "en",
        "user-agent": UA,
        "referer": "https://x.com/",
        "origin": "https://x.com",
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
    }


def auth_error(status: int, body: str) -> None:
    if status in (401, 403):
        print(
            "ERROR: cookies rejected by X (HTTP "
            f"{status}). Cookies have probably expired.\n"
            "  Re-grab `auth_token` and `ct0` and update .env.\n  " + SETUP_HINT,
            file=sys.stderr,
        )
    else:
        print(
            f"ERROR: unexpected HTTP {status} from X.\n  body[:300]: {body[:300]}",
            file=sys.stderr,
        )
    sys.exit(2)


async def resolve_user_id(client: httpx.AsyncClient, handle: str) -> str:
    variables = {"screen_name": handle, "withSafetyModeUserFields": True}
    features = {
        "hidden_profile_likes_enabled": True,
        "hidden_profile_subscriptions_enabled": True,
        "responsive_web_graphql_exclude_directive_enabled": True,
        "verified_phone_label_enabled": False,
        "subscriptions_verification_info_is_identity_verified_enabled": True,
        "subscriptions_verification_info_verified_since_enabled": True,
        "highlights_tweets_tab_ui_enabled": True,
        "responsive_web_twitter_article_notes_tab_enabled": True,
        "creator_subscriptions_tweet_preview_api_enabled": True,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
        "responsive_web_graphql_timeline_navigation_enabled": True,
    }
    params = {
        "variables": json.dumps(variables, separators=(",", ":")),
        "features": json.dumps(features, separators=(",", ":")),
    }
    r = await client.get(USER_BY_SCREEN_NAME_URL, params=params)
    if r.status_code != 200:
        auth_error(r.status_code, r.text)

    data = r.json()
    user = data.get("data", {}).get("user", {}).get("result")
    if not user or "rest_id" not in user:
        print(
            f"ERROR: handle @{handle} not found or returned no user payload.",
            file=sys.stderr,
        )
        sys.exit(2)
    return str(user["rest_id"])


def parse_tweet_datetime(raw: str | None) -> dt.datetime | None:
    if not raw:
        return None
    try:
        return dt.datetime.strptime(raw, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        return None


def _effective_since_dt(
    days_back: int | None,
    since_date: dt.date | None,
) -> dt.datetime | None:
    """Lower bound on tweet time (UTC): intersection of optional windows."""
    cutoffs: list[dt.datetime] = []
    if since_date is not None:
        cutoffs.append(
            dt.datetime.combine(since_date, dt.time.min, tzinfo=dt.timezone.utc),
        )
    if days_back is not None and days_back > 0:
        cutoffs.append(
            dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days_back),
        )
    if not cutoffs:
        return None
    return max(cutoffs)


async def fetch_user_tweets(
    client: httpx.AsyncClient,
    user_id: str,
    limit: int,
    days_back: int | None,
    since_date: dt.date | None,
    max_pages: int,
) -> list[dict[str, Any]]:
    since_dt = _effective_since_dt(days_back, since_date)

    tweets: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    cursor: str | None = None

    features = {
        "rweb_tipjar_consumption_enabled": True,
        "responsive_web_graphql_exclude_directive_enabled": True,
        "verified_phone_label_enabled": False,
        "creator_subscriptions_tweet_preview_api_enabled": True,
        "responsive_web_graphql_timeline_navigation_enabled": True,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
        "communities_web_enable_tweet_community_results_fetch": True,
        "c9s_tweet_anatomy_moderator_badge_enabled": True,
        "articles_preview_enabled": True,
        "tweetypie_unmention_optimization_enabled": True,
        "responsive_web_edit_tweet_api_enabled": True,
        "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
        "view_counts_everywhere_api_enabled": True,
        "longform_notetweets_consumption_enabled": True,
        "responsive_web_twitter_article_tweet_consumption_enabled": True,
        "tweet_awards_web_tipping_enabled": False,
        "creator_subscriptions_quote_tweet_preview_enabled": False,
        "freedom_of_speech_not_reach_fetch_enabled": True,
        "standardized_nudges_misinfo": True,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
        "rweb_video_timestamps_enabled": True,
        "longform_notetweets_rich_text_read_enabled": True,
        "longform_notetweets_inline_media_enabled": True,
        "responsive_web_enhance_cards_enabled": False,
    }
    for _ in range(max_pages):
        if len(tweets) >= limit:
            break

        remaining = max(1, limit - len(tweets))
        variables = {
            "userId": user_id,
            "count": min(MAX_TWEETS_PER_PAGE, remaining),
            "includePromotedContent": False,
            "withQuickPromoteEligibilityTweetFields": False,
            "withVoice": True,
            "withV2Timeline": True,
        }
        if cursor:
            variables["cursor"] = cursor

        params = {
            "variables": json.dumps(variables, separators=(",", ":")),
            "features": json.dumps(features, separators=(",", ":")),
        }
        r = await client.get(USER_TWEETS_URL, params=params)
        if r.status_code != 200:
            auth_error(r.status_code, r.text)

        page_tweets, next_cursor = _flatten_timeline(r.json())
        if not page_tweets:
            break

        page_oldest_dt: dt.datetime | None = None
        for t in page_tweets:
            tid = str(t.get("id") or "")
            if not tid or tid in seen_ids:
                continue
            seen_ids.add(tid)

            tweet_dt = parse_tweet_datetime(t.get("date"))
            if tweet_dt and (
                page_oldest_dt is None or tweet_dt < page_oldest_dt
            ):
                page_oldest_dt = tweet_dt

            if since_dt and tweet_dt and tweet_dt < since_dt:
                continue
            tweets.append(t)
            if len(tweets) >= limit:
                break

        # Timeline entries are reverse-chronological; once oldest in page is
        # beyond the cutoff, all further pages will be older.
        if since_dt and page_oldest_dt and page_oldest_dt < since_dt:
            break
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    return tweets


def _flatten_timeline(payload: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    """Walk X's nested timeline_v2 payload and pull tweets + bottom cursor."""
    out: list[dict[str, Any]] = []
    next_cursor: str | None = None
    try:
        instructions = payload["data"]["user"]["result"]["timeline_v2"]["timeline"][
            "instructions"
        ]
    except KeyError:
        return out, next_cursor
    for instr in instructions:
        for entry in instr.get("entries", []) or []:
            out.extend(_extract_from_entry(entry))
            candidate = _extract_cursor_from_entry(entry)
            if candidate:
                next_cursor = candidate
    return out, next_cursor


def _extract_cursor_from_entry(entry: dict[str, Any]) -> str | None:
    content = entry.get("content", {}) or {}
    if content.get("entryType") != "TimelineTimelineCursor":
        return None
    cursor_type = content.get("cursorType")
    if cursor_type not in {"Bottom", "ShowMore", "ShowMoreThreads"}:
        return None
    value = content.get("value")
    return str(value) if value else None


def _extract_from_entry(entry: dict[str, Any]) -> list[dict[str, Any]]:
    content = entry.get("content", {}) or {}
    etype = content.get("entryType") or content.get("__typename")
    if etype == "TimelineTimelineItem":
        item = content.get("itemContent") or {}
        if item.get("itemType") == "TimelineTweet":
            t = _serialize_tweet(item.get("tweet_results", {}).get("result"))
            return [t] if t else []
    if etype == "TimelineTimelineModule":
        items = content.get("items") or []
        out: list[dict[str, Any]] = []
        for it in items:
            item = (it.get("item") or {}).get("itemContent") or {}
            if item.get("itemType") == "TimelineTweet":
                t = _serialize_tweet(item.get("tweet_results", {}).get("result"))
                if t:
                    out.append(t)
        return out
    return []


def _serialize_tweet(tweet: dict[str, Any] | None) -> dict[str, Any] | None:
    if not tweet:
        return None
    if tweet.get("__typename") == "TweetWithVisibilityResults":
        tweet = tweet.get("tweet") or {}
    legacy = tweet.get("legacy") or {}
    if not legacy:
        return None

    tid = str(tweet.get("rest_id") or legacy.get("id_str") or "")
    if not tid:
        return None

    user_legacy = (
        ((tweet.get("core") or {}).get("user_results") or {})
        .get("result", {})
        .get("legacy", {})
    )
    screen_name = user_legacy.get("screen_name", "")

    quoted = (tweet.get("quoted_status_result") or {}).get("result")
    quoted_text = ""
    quoted_url = ""
    if quoted:
        q_inner = (
            quoted.get("tweet")
            if quoted.get("__typename") == "TweetWithVisibilityResults"
            else quoted
        ) or {}
        q_legacy = q_inner.get("legacy") or {}
        quoted_text = q_legacy.get("full_text", "")
        q_user_legacy = (
            ((q_inner.get("core") or {}).get("user_results") or {})
            .get("result", {})
            .get("legacy", {})
        )
        q_handle = q_user_legacy.get("screen_name", "")
        q_id = str(q_inner.get("rest_id") or q_legacy.get("id_str") or "")
        if q_handle and q_id:
            quoted_url = f"https://x.com/{q_handle}/status/{q_id}"

    return {
        "id": tid,
        "url": f"https://x.com/{screen_name}/status/{tid}" if screen_name else "",
        "date": legacy.get("created_at"),
        "text": legacy.get("full_text", ""),
        "lang": legacy.get("lang"),
        "reply_count": legacy.get("reply_count", 0) or 0,
        "retweet_count": legacy.get("retweet_count", 0) or 0,
        "like_count": legacy.get("favorite_count", 0) or 0,
        "view_count": int(((tweet.get("views") or {}).get("count") or 0) or 0),
        "is_reply": bool(legacy.get("in_reply_to_status_id_str")),
        "is_retweet": bool(legacy.get("retweeted_status_result")),
        "is_quote": bool(legacy.get("is_quote_status")),
        "quoted_text": quoted_text,
        "quoted_url": quoted_url,
    }


def filter_new(
    tweets: list[dict[str, Any]], cursor: str | None
) -> list[dict[str, Any]]:
    if not cursor:
        return tweets
    return [t for t in tweets if t.get("id") and t["id"] > cursor]


async def main_async(args: argparse.Namespace) -> int:
    load_env()
    ensure_dirs()
    cookies = require_cookies()
    handle = args.handle or get_handle()
    cursor = None if args.full else read_cursor()
    since_date = dt.date.fromisoformat(args.since_date)

    print(
        f"[scrape] target=@{handle}  cursor={cursor or '(none)'}  "
        f"limit={args.limit}  since_date={since_date.isoformat()}  "
        f"days_back={args.days_back if args.days_back else 'all'}  "
        f"max_pages={args.max_pages}"
    )

    headers = build_headers(cookies["ct0"])
    async with httpx.AsyncClient(
        headers=headers, cookies=cookies, follow_redirects=True, timeout=30.0
    ) as client:
        try:
            user_id = await resolve_user_id(client, handle)
        except httpx.HTTPError as exc:
            print(f"ERROR: network failure resolving @{handle}: {exc}", file=sys.stderr)
            return 2

        try:
            tweets = await fetch_user_tweets(
                client,
                user_id,
                args.limit,
                args.days_back,
                since_date,
                args.max_pages,
            )
        except httpx.HTTPError as exc:
            print(f"ERROR: network failure fetching tweets: {exc}", file=sys.stderr)
            return 2

    print(f"[scrape] fetched {len(tweets)} tweets in window")
    new_tweets = tweets if args.full else filter_new(tweets, cursor)
    print(f"[scrape] {len(new_tweets)} new tweets since cursor")

    today = dt.date.today().isoformat()
    out_path: Path = OUTPUT_DIR / f"raw-{today}.json"
    write_json(
        out_path,
        {
            "handle": handle,
            "user_id": user_id,
            "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "tweets": new_tweets,
        },
    )
    print(f"[scrape] wrote {out_path.relative_to(OUTPUT_DIR.parent)}")

    if new_tweets:
        max_id = max(t["id"] for t in new_tweets if t.get("id"))
        write_cursor(max_id)
        print(f"[scrape] cursor advanced to {max_id}")

    return 0 if new_tweets else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scrape tweets via X GraphQL with cookie auth."
    )
    parser.add_argument("--handle", default=None, help="Override TWITTER_HANDLE env.")
    parser.add_argument(
        "--limit", type=int, default=5000, help="Max tweets to pull per run."
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=365,
        help="Only keep tweets from the last N days. Use 0 for no rolling cutoff.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=80,
        help="Maximum timeline pages to request when paginating.",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Ignore stored cursor and pull the full window.",
    )
    parser.add_argument(
        "--since-date",
        default="2026-01-01",
        help="Keep tweets on/after this date (YYYY-MM-DD), combined with --days-back.",
    )
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
