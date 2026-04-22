/* eslint-disable */
// One-off seed script: prints SQL to stdout that inserts all JSON data
// into Supabase. Run via `node scripts/build_seed.js > /tmp/seed.sql`.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const PEOPLE_DIR = path.join(DATA, "people");

function q(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function qjson(v) {
  const s = JSON.stringify(v ?? null).replace(/'/g, "''");
  return `'${s}'::jsonb`;
}

function line(...cells) {
  return `(${cells.join(", ")})`;
}

const people = JSON.parse(fs.readFileSync(path.join(DATA, "people.json"), "utf8"));

let out = [];
out.push("-- auto-generated seed");
out.push("begin;");

// people
out.push("insert into public.people (slug,name,handle,tagline,accent,active,sort_order) values");
out.push(
  people
    .map((p, i) =>
      line(q(p.slug), q(p.name), q(p.handle), q(p.tagline), q(p.accent), q(p.active ?? true), i),
    )
    .join(",\n") +
    " on conflict (slug) do update set name=excluded.name, handle=excluded.handle, tagline=excluded.tagline, accent=excluded.accent, active=excluded.active, sort_order=excluded.sort_order;",
);

for (const person of people) {
  const slug = person.slug;
  const pdir = path.join(PEOPLE_DIR, slug);
  if (!fs.existsSync(pdir)) continue;

  // themes
  const themesPath = path.join(pdir, "themes.json");
  if (fs.existsSync(themesPath)) {
    const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));
    if (themes.length > 0) {
      out.push(
        "insert into public.themes (person_slug,slug,label,accent,sort_order) values",
      );
      out.push(
        themes
          .map((t) =>
            line(q(slug), q(t.slug), q(t.label), q(t.accent), q(t.sort_order ?? 0)),
          )
          .join(",\n") +
          " on conflict (person_slug, slug) do update set label=excluded.label, accent=excluded.accent, sort_order=excluded.sort_order;",
      );
    }
  }

  // site_meta
  const metaPath = path.join(pdir, "site_meta.json");
  if (fs.existsSync(metaPath)) {
    const m = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    out.push(
      "insert into public.site_meta (person_slug,handle,follower_count,current_thesis_md,claimed_ytd_pct,last_updated) values " +
        line(
          q(slug),
          q(m.handle),
          q(m.follower_count ?? 0),
          q(m.current_thesis_md ?? ""),
          q(m.claimed_ytd_pct ?? 0),
          q(m.last_updated ?? new Date().toISOString().slice(0, 10)),
        ) +
        " on conflict (person_slug) do update set handle=excluded.handle, follower_count=excluded.follower_count, current_thesis_md=excluded.current_thesis_md, claimed_ytd_pct=excluded.claimed_ytd_pct, last_updated=excluded.last_updated;",
    );
  }

  // picks (dedupe by ticker, merging tweet_events of duplicates into the first entry)
  const picksPath = path.join(pdir, "picks.json");
  if (fs.existsSync(picksPath)) {
    const rawPicks = JSON.parse(fs.readFileSync(picksPath, "utf8"));
    const byTicker = new Map();
    for (const p of rawPicks) {
      const existing = byTicker.get(p.ticker);
      if (!existing) {
        byTicker.set(p.ticker, { ...p, tweet_events: [...(p.tweet_events ?? [])] });
      } else {
        for (const ev of p.tweet_events ?? []) {
          if (!existing.tweet_events.some((e) => e.tweet_id === ev.tweet_id)) {
            existing.tweet_events.push(ev);
          }
        }
      }
    }
    const picks = Array.from(byTicker.values());
    if (picks.length > 0) {
      out.push(
        "insert into public.picks (person_slug,ticker,name,theme,stance,conviction,thesis_short,thesis_long,first_mentioned_at,tweet_url,tweet_id,exited_at,exit_price,sort_order) values",
      );
      out.push(
        picks
          .map((p, i) =>
            line(
              q(slug),
              q(p.ticker),
              q(p.name ?? ""),
              q(p.theme),
              q(p.stance),
              q(p.conviction),
              q(p.thesis_short ?? ""),
              q(p.thesis_long ?? ""),
              q(p.first_mentioned_at ?? new Date().toISOString().slice(0, 10)),
              q(p.tweet_url ?? ""),
              q(p.tweet_id ?? ""),
              q(p.exited_at ?? null),
              q(p.exit_price ?? null),
              i,
            ),
          )
          .join(",\n") +
          " on conflict (person_slug, ticker) do update set name=excluded.name, theme=excluded.theme, stance=excluded.stance, conviction=excluded.conviction, thesis_short=excluded.thesis_short, thesis_long=excluded.thesis_long, first_mentioned_at=excluded.first_mentioned_at, tweet_url=excluded.tweet_url, tweet_id=excluded.tweet_id, exited_at=excluded.exited_at, exit_price=excluded.exit_price, sort_order=excluded.sort_order;",
      );

      // tweet_events
      const events = [];
      for (const p of picks) {
        for (const ev of p.tweet_events ?? []) {
          events.push({
            person_slug: slug,
            ticker: p.ticker,
            tweet_id: ev.tweet_id,
            tweeted_at: ev.tweeted_at ?? null,
            tweet_url: ev.tweet_url ?? "",
            text: ev.text ?? null,
          });
        }
      }
      if (events.length > 0) {
        out.push(
          "insert into public.tweet_events (person_slug,ticker,tweet_id,tweeted_at,tweet_url,text) values",
        );
        out.push(
          events
            .map((ev) =>
              line(
                q(ev.person_slug),
                q(ev.ticker),
                q(ev.tweet_id),
                q(ev.tweeted_at),
                q(ev.tweet_url),
                q(ev.text),
              ),
            )
            .join(",\n") +
            " on conflict (person_slug, ticker, tweet_id) do update set tweeted_at=excluded.tweeted_at, tweet_url=excluded.tweet_url, text=excluded.text;",
        );
      }
    }
  }

  // prices
  const pricesPath = path.join(pdir, "prices.json");
  if (fs.existsSync(pricesPath)) {
    const prices = JSON.parse(fs.readFileSync(pricesPath, "utf8"));
    const rows = Object.entries(prices);
    if (rows.length > 0) {
      out.push(
        "insert into public.prices (person_slug,ticker,price,market_cap,currency,ytd_pct,history,metrics,updated_at) values",
      );
      out.push(
        rows
          .map(([ticker, v]) =>
            line(
              q(slug),
              q(ticker),
              q(v.price ?? null),
              q(v.market_cap ?? null),
              q(v.currency ?? "USD"),
              q(v.ytd_pct ?? 0),
              qjson(v.history ?? []),
              qjson(v.metrics ?? {}),
              q(v.updated_at ?? new Date().toISOString().slice(0, 10)),
            ),
          )
          .join(",\n") +
          " on conflict (person_slug, ticker) do update set price=excluded.price, market_cap=excluded.market_cap, currency=excluded.currency, ytd_pct=excluded.ytd_pct, history=excluded.history, metrics=excluded.metrics, updated_at=excluded.updated_at;",
      );
    }
  }
}

out.push("commit;");
process.stdout.write(out.join("\n") + "\n");
