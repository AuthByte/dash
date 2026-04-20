# Serenity's Picks

A self-hosted, version-controlled tracker for [@aleabitoreddit](https://x.com/aleabitoreddit)'s public stock picks. Dark terminal aesthetic, theme/stance/conviction taxonomy, on-demand price refresh, and an LLM-driven ingest pipeline so you don't have to copy-paste tweets.

```
       ┌─────────────┐    ┌────────────┐    ┌──────────────┐
tweets │ X GraphQL   │ -> │ OpenRouter │ -> │ digest JSON  │
─────> │  (Python)   │    │  (Claude)  │    │  (you review)│
       └─────────────┘    └────────────┘    └──────┬───────┘
                                                   │
              ┌────────────────────────────────────┘
              v
       ┌─────────────┐    ┌──────────────┐    ┌───────────┐
       │ Cursor edits│ -> │ data/picks   │ -> │ Next.js   │
       │ picks.json  │    │ data/prices  │    │ static SSG│
       └─────────────┘    └──────────────┘    └───────────┘
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
# Edit .env: paste your OPENROUTER_API_KEY

# 4. Run dev server
npm run dev
# -> http://localhost:3000
```

The site renders fine immediately because [data/picks.json](data/picks.json) ships with seed data pulled from the screenshot. From here you have two operational loops to set up.

---

## Loop 1 — Refreshing prices

You want this whenever you care about price/YTD/market-cap drift. It only needs to run as often as you care.

```bash
npm run refresh                    # all tickers
npm run refresh -- --ticker IQE.L  # one ticker
```

This calls Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2), supports international tickers (`IQE.L`, `ALRIB.ST`, `SOI` on EuroNext, etc.), and writes [data/prices.json](data/prices.json). The drawer's mini chart populates automatically once history exists.

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
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

Default model is Claude 3.5 Sonnet (~$0.07/run for ~50 tweets). For cheaper test runs, swap to `openai/gpt-4o-mini` (~$0.005/run). Override per-run with `npm run scrape -- --model openai/gpt-4o-mini` (or call `python scripts/run.py --model ...`).

### 2c. The actual command

```bash
npm run scrape
# or directly:
python scripts/run.py
```

This:

1. **Scrapes** `@aleabitoreddit` (configurable via `TWITTER_HANDLE` env) and writes raw tweets to `scrape-output/raw-YYYY-MM-DD.json`. Stores a cursor (`scrape-output/.cursor`) so subsequent runs only fetch new tweets.
2. **Digests** those tweets via OpenRouter with a strict JSON-schema response and your existing `picks.json` as dedupe context. Output goes to `scrape-output/digest-YYYY-MM-DD.json`.
3. **Prints** a clearly-fenced block at the end labeled `=== PASTE THIS TO CURSOR ===`. Copy that whole block into a fresh Cursor chat with this repo open, and the agent will diff it against [data/picks.json](data/picks.json) and apply changes.

Useful flags:

```bash
python scripts/run.py --skip-scrape           # reuse the latest raw-*.json (re-digest)
python scripts/run.py --full                  # ignore cursor, pull a full window
python scripts/run.py --model openai/gpt-4o-mini   # cheaper run
```

If no new tweets are found, the script exits cleanly with no LLM call.

---

## Editing picks by hand

The whole data layer is just three JSON files in [`data/`](data/):

- [`data/picks.json`](data/picks.json) — array of pick objects. Add, edit, or remove freely.
- [`data/site_meta.json`](data/site_meta.json) — current thesis blockquote, follower count, last_updated.
- [`data/themes.json`](data/themes.json) — taxonomy. Adding a new theme requires updating [`lib/schema.ts`](lib/schema.ts) `ThemeSlugSchema` enum.
- [`data/prices.json`](data/prices.json) — generated by `npm run refresh`. Don't hand-edit; it'll get overwritten.

Every file is validated at build time by [zod schemas](lib/schema.ts). A malformed edit breaks `next build` loudly with a clear error rather than silently corrupting the site.

---

## Deploy

```bash
npm run build
```

Standard static Next.js. Push to GitHub and import into Vercel (or anywhere). No env vars are required at build/runtime — `OPENROUTER_API_KEY` is only used by the local Python scripts.

The site is fully prerendered (`force-static`), so deploys are instant and there's nothing to pay for at scale.

---

## Project layout

```
.
├── app/                    Next.js App Router (pages + components)
│   ├── components/
│   ├── globals.css         Tailwind v4 + design tokens
│   ├── layout.tsx
│   └── page.tsx            Single dashboard route
├── data/                   Source-of-truth JSON
├── lib/
│   ├── data.ts             Server-only loaders + derived stats
│   ├── format.ts           Number/currency/date formatters
│   └── schema.ts           Zod schemas for every data file
├── scripts/
│   ├── prompts/
│   │   └── digest_system.md  System prompt for the LLM digest
│   ├── common.py           Shared paths & env helpers
│   ├── scrape.py           X GraphQL (cookie auth) -> raw-*.json
│   ├── digest.py           OpenRouter LLM -> digest-*.json
│   ├── run.py              Orchestrator + Cursor handoff block
│   └── refresh.ts          yahoo-finance2 -> data/prices.json
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
