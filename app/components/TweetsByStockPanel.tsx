"use client";

import type { EnrichedPick } from "@/lib/data";
import { formatDate } from "@/lib/format";

type TweetEvent = {
  tweet_id: string;
  tweet_url: string;
  tweeted_at: string;
};

export function TweetsByStockPanel({ picks }: { picks: EnrichedPick[] }) {
  const rows = picks
    .map((pick) => ({
      pick,
      tweets: getTweetEvents(pick),
    }))
    .filter((row) => row.tweets.length > 0)
    .sort((a, b) => a.pick.ticker.localeCompare(b.pick.ticker));

  return (
    <section className="mt-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          / Tweets by Stock
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          {rows.reduce((sum, row) => sum + row.tweets.length, 0)} tweets
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          No tweets available for current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ pick, tweets }) => (
            <div
              key={pick.ticker}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-3 sm:px-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-white">
                    {pick.ticker}
                  </p>
                  <p className="text-xs text-[var(--color-text-dim)]">{pick.name}</p>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  {tweets.length} tweet{tweets.length === 1 ? "" : "s"}
                </p>
              </div>

              <ul className="space-y-1.5">
                {tweets.map((tweet) => (
                  <li key={`${pick.ticker}-${tweet.tweet_id}`}>
                    <a
                      href={tweet.tweet_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded border border-[var(--color-border)] px-2.5 py-2 font-mono text-[11px] text-[var(--color-text-dim)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                    >
                      <span>
                        {formatDate(tweet.tweeted_at)} · Tweet #{tweet.tweet_id}
                      </span>
                      <span aria-hidden>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getTweetEvents(pick: EnrichedPick): TweetEvent[] {
  if (pick.tweet_events && pick.tweet_events.length > 0) {
    return [...pick.tweet_events]
      .filter((event) => event.tweeted_at && event.tweet_url)
      .sort((a, b) => b.tweeted_at.localeCompare(a.tweeted_at))
      .map((event) => ({
        tweet_id: event.tweet_id,
        tweet_url: event.tweet_url,
        tweeted_at: event.tweeted_at,
      }));
  }
  if (!pick.tweet_url || !pick.first_mentioned_at) return [];
  return [
    {
      tweet_id: pick.tweet_id,
      tweet_url: pick.tweet_url,
      tweeted_at: pick.first_mentioned_at,
    },
  ];
}
