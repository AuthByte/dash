# Serenity's Picks

A self-hosted multi-profile tracker for public stock picks (Serenity plus additional desks). Dark editorial aesthetic, theme/stance/conviction taxonomy, on-demand price refresh, and an LLM ingest pipeline.

All operational state can live in **Supabase** (`dashboard`). The Next.js site prefers Postgres, then falls back to `data/people/<slug>/*.json` if Supabase is paused, slow, or empty. Python scripts write both local JSON and Supabase when configured.

```
       ┌─────────────┐    ┌────────────┐    ┌──────────────┐
tweets │ X GraphQL   │ -> │ OpenRouter │ -> │ digest JSON  │
─────> │  (Python)   │    │  (Claude)  │    │  (you review)│
       └─────────────┘    └────────────┘    └──────┬───────┘
                                                   │
              ┌────────────────────────────────────┘
              v
       ┌────────────────┐    ┌──────────┐    ┌───────────┐
       │ apply_digest.py│ -> │ Supabase │ -> │ Next.js   │
       │ (picks/events) │    │ Postgres │    │ (SSR+ISR) │
       └────────────────┘    └──────────┘    └───────────┘
```

---

## Quick start

```bash
# 1. Install JS deps
npm install

# 2. Install Python deps (in a venv)
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS/Linux
pip install -r requirements.txt

# 3. Configure secrets
copy .env.example .env           # Windows
# cp .env.example .env           # macOS/Linux
# Edit .env: paste your OPENROUTER_API_KEY and fill in the Supabase section.

# 4. Run dev server
npm run dev
# -> http://localhost:3000
```

The site renders immediately because Supabase ships with a seeded row set (see "Seeding Supabase" below). From here you have two operational loops to set up.

### Supabase schema

Six tables in `public`:

- `people`        — profiles (`slug`, `name`, `handle`, `tagline`, `accent`, `active`, `sort_order`)
- `themes`        — per-person taxonomy (`person_slug`, `slug`, `label`, `accent`, `sort_order`)
- `site_meta`     — per-person thesis blob + follower count + YTD claim
- `picks`         — one row per (`person_slug`, `ticker`) with thesis/stance/conviction + tweet provenance
- `tweet_events`  — every tweet that mentioned a ticker (`person_slug`, `ticker`, `tweet_id`)
- `prices`        — one row per (`person_slug`, `ticker`) with price/market_cap/history/metrics (refreshed by `npm run refresh`)

Row-level security is on; public `select` is allowed, writes require the service-role key (or anon while policies are permissive for your dev project).

### Seeding Supabase

`scripts/build_seed.js` regenerates an idempotent SQL seed from any JSON fixtures you keep locally:

```bash
node scripts/build_seed.js > /tmp/seed.sql
# then paste into the Supabase SQL editor, or psql $SUPABASE_DB_URL -f /tmp/seed.sql
```


---

## Loop 1 — Refreshing prices

You want this whenever you care about price/YTD/market-cap drift. It only needs to run as often as you care.

```bash
npm run refresh                          # all active people, all tickers
npm run refresh -- --person serenity     # one person only
npm run refresh -- --ticker IQE.L        # one ticker across all people
```

This calls Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2), supports international tickers (`IQE.L`, `ALRIB.ST`, `SOI` on EuroNext, etc.), and **upserts into `public.prices` in Supabase**. The drawer's mini chart populates automatically once history exists. Needs `NEXT_PUBLIC_SUPABASE_URL` + (`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`) in `.env`.

Failures are logged but never abort the batch. Delisted or invalid tickers print a warning and skip.

### Optional: schedule it

Add a GitHub Action (template not included by default) that runs `npm install && npm run refresh` on cron and commits the diff to `main`. Vercel rebuilds automatically. ~20s per run, free tier safe.

---

## Loop 2 — Ingesting new tweets

This is the part you said you wanted to "just run a command" for. Three pieces:

### 2a. One-time cookie setup

The scraper hits X's public GraphQL endpoints directly with **cookie-session auth** — no username, password, or email password is ever stored, and no third-party scraper library to chase upstream X frontend changes. You log in once in your browser and paste two cookie values into `.env`. Use a **throwaway** X account; there's a non-zero risk of suspension.

1. Open [x.com](https://x.com/) in any normal browser and log in with the throwaway account.
2. Open DevTools (`F12` / `Cmd+Opt+I`) -> **Application** tab -> **Cookies** -> `https://x.com`.
3. Copy the **values** of two cookies:
   - `auth_token`  (long hex string)
   - `ct0`         (long hex string)
4. Paste into `.env`:

```
X_AUTH_TOKEN=<paste auth_token value>
X_CT0=<paste ct0 value>
```

5. Done. **Don't log out of that browser session** — logging out invalidates the cookies. They typically last a few weeks before X rotates them. If `npm run scrape` starts failing with a "cookies rejected" message, just repeat steps 1-4.

### 2b. Get an OpenRouter key

Sign up at [openrouter.ai](https://openrouter.ai/), grab a key, paste it into `.env`:

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-oss-20b:free
```

Default digest model is a **free** OpenRouter endpoint (`openai/gpt-oss-20b:free`) with automatic fallbacks (`google/gemma-4-31b-it:free`, `openrouter/free`) when structured-output is unavailable. Paid models still work via `--model`.

### 2c. The actual command

```bash
# one desk
python scripts/run.py --person firstadopter --handle firstadopter --full --model openai/gpt-oss-20b:free

# every active desk in data/people.json
python scripts/bootstrap_people.py --supabase
python scripts/ingest_people.py --full --model openai/gpt-oss-20b:free
```

This:

1. **Scrapes** the given handle (or `TWITTER_HANDLE`) into `scrape-output/<slug>/raw-YYYY-MM-DD.json` with a per-desk cursor.
2. **Digests** tweets via OpenRouter (free model by default) with JSON-schema when supported, otherwise JSON-object / raw JSON extraction.
3. **Applies** into local `data/people/<slug>/picks.json` and, when reachable, Supabase `picks` / `tweet_events` / `site_meta`.

Useful flags:

```bash
python scripts/run.py --skip-scrape --person serenity
python scripts/run.py --full --person bourboncap --handle bourboncap
python scripts/ingest_people.py --only firstadopter,globalflows --skip-scrape
```

If no new tweets are found, the script exits cleanly with no LLM call.

---

## Editing picks by hand

Everything is in Supabase. Use the Supabase table editor for fast edits, or write a quick SQL statement in the SQL editor:

```sql
update public.picks
   set thesis_short = 'Updated thesis',
       stance       = 'long'
 where person_slug = 'serenity'
   and ticker      = 'AAOI';
```

Adding a new theme slug still requires updating [`lib/schema.ts`](lib/schema.ts) `ThemeSlugSchema` enum (the zod parser validates every read) and then inserting a row into `public.themes`. Every Supabase row is validated at runtime by [zod schemas](lib/schema.ts); a malformed row blows up the page render loudly rather than corrupting the site silently.

---

## Deploy

```bash
npm run build
```

Standard Next.js. Push to GitHub and import into Vercel (or anywhere). At build/runtime you need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`OPENROUTER_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` are only used by the local scripts.

The dashboard routes are `force-dynamic` so a paused or empty database can fall back to local JSON without a rebuild. Set `SITE_URL` for sitemap/robots.

---

## Project layout

```
.
├── app/                    Next.js App Router (pages + components)
│   ├── components/
│   ├── globals.css         Tailwind v4 + design tokens
│   ├── layout.tsx
│   ├── page.tsx            Profile picker
│   └── [person]/           Per-profile dashboard
├── lib/
│   ├── data.ts             Server-only Supabase loaders + derived stats
│   ├── supabase.ts         Supabase client factory
│   ├── format.ts           Number/currency/date formatters
│   └── schema.ts           Zod schemas for the Supabase row shapes
├── scripts/
│   ├── prompts/
│   │   └── digest_system.md  System prompt for the LLM digest
│   ├── common.py           Shared paths & env helpers
│   ├── scrape.py           X GraphQL (cookie auth) -> raw-*.json
│   ├── digest.py           OpenRouter LLM -> digest-*.json (reads Supabase picks for dedupe)
│   ├── apply_digest.py     Upserts digest-*.json into Supabase
│   ├── build_seed.js       One-off: dump local JSON -> idempotent SQL seed
│   ├── run.py              Orchestrator + Cursor handoff block
│   └── refresh.ts          yahoo-finance2 -> public.prices in Supabase
├── requirements.txt
├── package.json
└── README.md (you are here)
```

---

## Tweaking the LLM

The system prompt lives in [`scripts/prompts/digest_system.md`](scripts/prompts/digest_system.md). Edit it to:

- Add a new theme keyword cluster
- Tighten the conviction rules
- Change the "ignore" criteria
- Adjust ticker normalization (e.g. add a new exchange suffix)

Output schema enforcement happens in [`scripts/digest.py`](scripts/digest.py) (`pick_schema`, `response_schema`). If you change the system prompt's allowed enums, mirror them there too.

---

## Not investment advice

This is a fan tracker. Do your own work.
