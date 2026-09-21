# Caprae Lead Verification Tool

A Next.js web application that verifies acquisition-target leads by extracting facts from company websites, showing the proof behind every claim, and ranking leads by acquisition fit.

## Overview

Caprae helps acquisition searchers and operators verify small-business leads by:
- **Extracting facts** from a company's own website, each with a supporting quote
- **Confirming those facts** actually appear on the scraped page before trusting them
- **Scoring acquisition fit** (0–100) based on owner-operation, years in business, location count, team size, and reachability — only for facts that were actually confirmed
- **Detecting conflicts** between imported data (a CSV, or Overture Maps) and what the website says
- **Generating call briefs** for quick outreach prep

Anything the tool can't find — or can't confirm — is shown as "not found" / "unconfirmed". It never guesses, and it never scores a guess.

## Setup

### Prerequisites
- Node.js 18+
- pnpm

### 1. Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). At this point the app already works: **"Load Demo Companies"** and **CSV upload** need no API keys at all — they use 10 pre-verified sample companies (`lib/dummy-data.ts`).

### 2. Configure API keys (for the two "real data" features)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Needed for | Works out of the box? |
|---|---|---|
| `OVERTURE_API_KEY` | "Fetch Real Companies" — pulls live businesses from Overture Maps | **Yes** — defaults to `DEMO-API-KEY` |
| `OPEN_ROUTER_API_KEY` | Real AI verification (scrape + fact extraction) | **No** — must be a real, funded key |

**`OVERTURE_API_KEY` — the demo key just works, with one restriction.** Left unset, it defaults to `DEMO-API-KEY` against [api.overturemapsapi.com](https://api.overturemapsapi.com). Demo keys are restricted server-side to queries within 10km of four fixed cities: New York, London, Paris, and Bondi Beach. Of this app's configured states (`lib/overture-data.ts` → `STATE_COORDS`), only **`NY`** (mapped to NYC) falls inside that radius — `OH`/`CA`/`TX`/`FL` are wired correctly but will return no results until you set a real (non-demo) key, obtained from api.overturemapsapi.com.

**`OPEN_ROUTER_API_KEY` — must be a real key on a funded account, not just any key.** Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). Two things trip people up here:
1. **A key's own spending limit is not account balance.** When you create a key, OpenRouter lets you set a `$` limit on that key — this only *caps* how much the key may spend from the account's real balance, it does not add money. A key with a `$50` limit on an account that has never purchased credits will still fail with `402 Insufficient credits. This account never purchased credits.` Add actual credits at [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits) for the account the key belongs to.
2. **Multiple accounts/orgs are easy to mix up.** If the key was generated under a different account/org than the one you funded, you'll see the same error. Double-check which account you're logged into at the credits URL against where the key was created.

Without `OPEN_ROUTER_API_KEY` set, `POST /api/companies/verify-real` returns a `400` — the rest of the app (demo data, CSV upload) is unaffected.

### 3. Try it

1. **Load Demo Companies** (fastest, no keys) — 10 pre-verified companies with full evidence
2. **Fetch Real Companies** (needs both keys funded/working) — real businesses from Overture Maps, real scrape + AI verification
3. **Upload a CSV** — columns `domain` or `name` (required), `revenue`/`employees`/`owner`/`phone`/`email` (optional); see `public/sample-companies.csv`

## How It Works

1. **Import** — CSV upload, or fetch real businesses live from Overture Maps
2. **Clean** — normalize domains, dedupe exact and fuzzy-matched duplicates
3. **Fetch** — scrape the homepage/about/contact pages, respecting `robots.txt`
4. **Extract & verify** — an LLM pulls out facts; code confirms each fact's underlying value (not just the AI's phrasing) is actually present on the page
5. **Score** — fit score + evidence level, counting **only** facts that were confirmed in step 4; conflicts flagged against imported data
6. **Review & export** — ranked table, evidence panel per company (with source quotes and a clear Verified / Found-but-unconfirmed / Not-found status per fact), CRM-ready CSV

## Data Sources

### Overture Maps (real data)
Fetched live from [api.overturemapsapi.com](https://api.overturemapsapi.com) (a third-party REST wrapper over the Overture Maps dataset — no DuckDB or S3 access needed). See `lib/overture-data.ts`. Also pulls the business's own listed phone/email as a **second source**, stored as `importedPhone`/`importedEmail` and cross-checked against whatever the AI later confirms on the actual website (see "Conflict detection" below).

See the Setup section above for the demo-key city restriction and category-filtering limitation.

### Sample/dummy data
10 pre-verified companies with complete quotes and sources, used by "Load Demo Companies" and as a fallback when a CSV domain has no match. See `lib/dummy-data.ts`.

## AI Verification

Real verification (`POST /api/companies/verify-real`) processes companies **concurrently** (`VERIFY_CONCURRENCY = 8` in `app/api/companies/verify-real/route.ts` — companies are almost always different domains, so there's no politeness reason to serialize across them). Per company:

1. Checks `robots.txt`; honors any `Crawl-delay` directive, capped at 5s (`MAX_CRAWL_DELAY_SECONDS`) so one outlier site (some specify 30s+) can't stall the whole batch — see the comment at that constant for the reasoning
2. Scrapes homepage + about + contact pages (`lib/web-scraper.ts`, via `cheerio`)
3. Sends the scraped text to an LLM via **OpenRouter** (OpenAI-compatible API) for structured fact extraction (`lib/ai-verification.ts`, model `openai/gpt-5.4-mini`)
4. Confirms each extracted **value** — the phone number, the email, the name, the year, the count — is actually present on the page (`verifyValueAuthenticity`), not the AI's exact phrasing around it. Matching the value rather than the full quote sentence is deliberately more forgiving of paraphrasing while still rejecting genuinely fabricated values — phone numbers match by digit-stream (formatting-independent), numbers match as whole numbers with thousands-separators normalized, names/emails match case-insensitively.
5. Scores fit and evidence level, counting only confirmed facts (see Scoring below); detects conflicts with imported data (Overture/CSV), also only using confirmed facts; generates a call brief

**Reliability:** transient OpenRouter errors (429, 5xx, and the "would exceed credits given in-flight requests" flavor of 402 — expected under concurrency) are retried automatically. A genuine "insufficient balance" 402 is **not** retried (retrying can't fix a real balance shortfall) — instead, the exact affordable token budget OpenRouter reports is parsed from its own error message and the request retries once at that budget, so a tight-but-nonzero balance still succeeds instead of failing outright.

Requires `OPEN_ROUTER_API_KEY` on a funded account — see Setup above. Without it, `/api/companies/verify-real` returns a `400`.

The CSV-upload and "Load Demo Companies" flows use a separate, simpler path (`POST /api/companies/verify`) that looks up pre-verified dummy data by domain — fast and always works, by design, for demos.

### Showing unconfirmed facts instead of hiding them

A fact the AI extracted but couldn't confirm on the page isn't dropped — it's shown in the evidence panel with a clear **"Found — unconfirmed"** badge (distinct from "Verified on site" and "Not found"), so a searcher can still see what the AI thought it saw and judge it themselves. What confirmation status *does* control is **scoring**: an unconfirmed fact earns zero points and doesn't count toward evidence level, identically to a fact that was never found at all (see Scoring below) — so a high score is only ever built on confirmed information, never on a plausible-looking guess.

## Scoring

| Signal | Weight | Earns points when |
|---|---|---|
| Owner-operated | 25 | A named owner/founder is confirmed on the site |
| Years in business | 20 | Confirmed founding year, longer history up to ~25 years |
| Single/few locations | 20 | Confirmed location count; not a franchise or chain |
| Size fit | 15 | Confirmed team size in the target range (5–50, ideal 15) |
| Reachability | 10 | Confirmed working phone + confirmed verified email |
| Data consistency | 10 | At least one confirmed fact, and it agrees with imported data |

Every signal requires the fact to be *confirmed* (`verifyValueAuthenticity` passed), not merely extracted — a company with zero confirmed facts scores exactly **0**, not a partial credit for unverified claims. Evidence level is the share of these six signals confirmed: **high** (5–6), **medium** (3–4), **low** (0–2). See `lib/scoring.ts`.

### Conflict detection (second-source cross-check)
`detectConflicts` compares imported data (a CSV column, or Overture Maps' own listing) against what the AI confirmed on the site — owner name, team size, and phone (normalized so formatting differences like `"+1 (555) 111-2222"` vs `"555-111-2222"` don't false-flag). Only confirmed facts are compared; an unconfirmed AI value is never trusted enough to call a real conflict, or to silently count as "no conflict" for scoring purposes.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | In-memory (`lib/db/`) — schema (`lib/db/schema.ts`) is Drizzle-shaped, ready to point at Postgres/Neon |
| Fetching | `fetch` + `cheerio`, robots.txt check, per-site delay |
| Real company data | Overture Maps via api.overturemapsapi.com |
| AI extraction | OpenRouter (`openai/gpt-5.4-mini`) |
| CSV | PapaParse |
| Hosting | Vercel-ready (serverless) |

## Project Structure

```
app/
├── api/
│   ├── companies/
│   │   ├── import/route.ts       # CSV upload → normalize → dedupe
│   │   ├── fetch-real/route.ts   # Overture Maps → companies
│   │   ├── verify/route.ts       # Dummy-data verification (CSV/demo flows)
│   │   ├── verify-real/route.ts  # Real scrape + OpenRouter verification (concurrent)
│   │   ├── export/route.ts       # CSV export
│   │   └── route.ts              # List companies, ranked by fit score
│   └── demo/route.ts             # Load the 10 dummy companies
├── globals.css
├── layout.tsx
└── page.tsx                      # 3-step workflow (upload → processing → results)

components/
├── ui/                           # shadcn base components
├── companies-table.tsx           # Ranked results table
├── evidence-panel.tsx            # Per-company evidence detail (Verified/Unconfirmed/Not found)
└── upload-form.tsx               # CSV upload

lib/
├── db/
│   ├── schema.ts                 # Drizzle-shaped schema
│   └── index.ts                  # In-memory implementation of that schema
├── ai-verification.ts            # OpenRouter fact extraction, value-authenticity check, retry logic
├── web-scraper.ts                # Fetch + robots.txt + cheerio parsing
├── overture-data.ts              # Overture Maps API client
├── csv-parser.ts                 # CSV import/export
├── deduplication.ts              # Domain/phone normalization + fuzzy name matching
├── dummy-data.ts                 # 10 pre-verified sample companies
├── scoring.ts                    # Fit score + evidence level + conflict detection
└── utils.ts
```

## Ethical Considerations

- Respects `robots.txt`; honors `Crawl-delay` (capped — see AI Verification above)
- Doesn't disguise the bot as a browser to get past sites that block it (Akamai/Cloudflare-style bot management) — a blocked site is reported honestly as "blocked by bot protection", not worked around
- Only extracts publicly available information
- Never guesses or fabricates — shows "not found" / "unconfirmed" instead, and never scores either
- All scores are explicitly heuristic, not a guarantee of acquisition quality

## Current Limitations

- No persistent storage — data resets on server restart (schema is ready for Postgres/Neon)
- Category filtering against the live Overture API is disabled — the API's `categories`/`taxonomy` params expect exact vocabulary terms, not the free-text fragments this app uses, so real-data fetches aren't filtered by trade
- Real Overture data only reliably covers NYC-area businesses without a paid (non-demo) Overture API key
- Sites with bot-detection/WAF protection (Akamai, Cloudflare) can't be verified — by design, not a bug (see Ethical Considerations)

## Future Enhancements

- [ ] Persist to Postgres (Neon) via the existing Drizzle schema
- [ ] Map free-text category fragments to Overture's real taxonomy terms
- [ ] User accounts, saved searches, custom scoring weights
- [ ] CRM integrations (HubSpot, Salesforce)
