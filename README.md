# Picks Tracker

Self-hosted multi-desk board for public stock picks. Dark editorial UI, theme/stance/conviction taxonomy, on-demand price refresh, and an LLM ingest pipeline that turns X posts into structured names.

The Next.js app reads **Supabase first**, then falls back to `data/people/<slug>/*.json` if the project is paused, slow, or empty. Python scripts write both local JSON and Postgres when configured.

```
tweets ── X GraphQL (Python) ──► OpenRouter (free model) ──► digest JSON
                                      │
                                      ▼
                            apply_digest.py ──► Supabase + local JSON
                                      │
                                      ▼
                                 Next.js (SSR)
```

---

## Quick start

```bash
npm install
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # Windows: copy .env.example .env
# Fill OPENROUTER_API_KEY, Supabase URL/keys, and optional X cookies.

npm run bootstrap-people                            # local fixtures (+ --supabase to upsert)
npm run avatars                                     # cache X profile photos into public/avatars
npm run dev                                         # http://localhost:3000
```

Required for a useful local run:

| Variable | Used by |
| --- | --- |
| `OPENROUTER_API_KEY` | `scripts/digest.py` |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Next + scripts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Next reads / script writes |
| `X_AUTH_TOKEN` + `X_CT0` | live tweet scrape |
| `SITE_URL` | sitemap, robots, canonical URLs |

`OPENROUTER_MODEL` defaults to the free `openai/gpt-oss-20b:free` with fallbacks.

---

## Roster

Desks live in [`data/people.json`](data/people.json) and `public.people`. Profile photos are cached at `public/avatars/<slug>.jpg` (fetched via [unavatar](https://unavatar.io) from X). The UI falls back to unavatar at runtime, then initials.

```bash
python scripts/bootstrap_people.py --supabase
python scripts/fetch_avatars.py
```

---

## Supabase schema

| Table | Role |
| --- | --- |
| `people` | slug, name, handle, tagline, accent, active, sort_order |
| `themes` | per-desk taxonomy |
| `site_meta` | thesis, follower count, claimed YTD |
| `picks` | one row per `(person_slug, ticker)` |
| `tweet_events` | tweets linked to a ticker |
| `prices` | spot, YTD, history, metrics (`npm run refresh`) |

Reads use the anon or service-role key. Writes should use the **service role**. Audit RLS before a public deploy (see issue tracker).

---

## Loop 1 — prices

```bash
npm run refresh                          # all active desks
npm run refresh -- --person serenity
npm run refresh -- --ticker IQE.L
```

Uses Financial Modeling Prep when configured, with a yfinance fallback. International tickers (`IQE.L`, `BTC-USD`, …) are supported. Failures skip the ticker and continue.

---

## Loop 2 — tweets → digest → picks

### Cookie setup (required for live scrape)

The scraper talks to X GraphQL with your browser session cookies. Use a throwaway account.

1. Log in at [x.com](https://x.com).
2. DevTools → Application → Cookies → `https://x.com`.
3. Copy `auth_token` and `ct0` into `.env` as `X_AUTH_TOKEN` and `X_CT0`.
4. Do not log that browser session out; cookies last a few weeks.

### Digest model

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-oss-20b:free
```

Free-model fallbacks: `google/gemma-4-31b-it:free`, `openrouter/free`. Paid models work via `--model`.

### Commands

```bash
# one desk
python scripts/run.py --person firstadopter --handle firstadopter --full

# every active desk
python scripts/ingest_people.py --full --model openai/gpt-oss-20b:free
```

Pipeline:

1. Scrape → `scrape-output/<slug>/raw-YYYY-MM-DD.json` (per-desk cursor).
2. Digest via OpenRouter (JSON schema → `json_object` → raw JSON extract).
3. Apply into `data/people/<slug>/picks.json` and, when reachable, Supabase.

Useful flags: `--skip-scrape`, `--only firstadopter,globalflows`, `--max-tweets 60`.

If scrape cookies are missing the command exits before the LLM call. A machine-readable summary is written to `scrape-output/ingest-summary.json`.

---

## App routes

| Path | What |
| --- | --- |
| `/` | Roster + search |
| `/<slug>` | Desk board (dynamic SSR) |
| `/api/health` | Liveness + people count |
| `/api/person/<slug>/pick/<ticker>` | Full pick + capped history |
| `/sitemap.xml` `/robots.txt` | SEO |

Unknown slugs return **HTTP 404**. Empty desks show an em dash for YTD, not `0.00%`.

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests, lint, and build.

---

## Project layout

```
app/                 App Router pages + components
lib/                 data loaders, zod schemas, stats, avatars
public/avatars/      cached X profile photos
scripts/             scrape, digest, apply, refresh, bootstrap, avatars
data/people/         JSON fixtures (fallback when Supabase is down)
```

LLM prompt: [`scripts/prompts/digest_system.md`](scripts/prompts/digest_system.md). Output schema: [`scripts/digest.py`](scripts/digest.py). Theme slugs are kebab-case strings, not a Serenity-only enum.

---

## Deploy

Standard Next.js. On Vercel set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL` (public origin)

Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` on the machine that runs ingest/refresh, not in the browser bundle.

Production deploy: GitHub Action **Deploy Vercel** (`workflow_dispatch`) uses secret `VERCEL_TOKEN`, or `npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`.

---

## Not investment advice

Fan tracker / research display only. Not a solicitation to buy or sell securities. Do your own work.
