Caprae lead-verification tool: build plan
Sep 21, 2026 · @Someone
We will build a Next.js web app that checks acquisition-target leads against each company's own website, shows the proof behind every fact, and ranks leads for calling, all within 5 hours.
What we build
A searcher uploads a list of small businesses and gets back a ranked list where every fact comes with proof from the company's own website. SaaSquatch, Caprae's sourcing tool, already produces long lists, but its revenue and owner data can be guesses, and a wasted call costs a searcher real time.
The tool acts like a careful research assistant. For each company it reports things like the owner's name, founding year, number of locations, and team size, and it quotes the exact sentence on the site that backs each one. Anything it cannot find is shown as "not found", never guessed.
•Who it is for: acquisition searchers and operators looking for owner-run small businesses to buy.
•Angle: verification and trust, not another scoring dashboard. Other candidates are already building scoring.
•AI's role: Claude reads the messy website text and extracts facts. Code then checks that each quoted sentence really appears on the page, and drops any fact that fails.
How it works
One loop takes a raw list to a call-ready shortlist in six steps.
flowchart LR
  A["1. Import<br/>CSV or domains"] --> B["2. Clean<br/>dedupe by domain"]
  B --> C["3. Fetch<br/>company pages"]
  C --> D["4. Extract<br/>Claude + quote check"]
  D --> E["5. Score<br/>fit + evidence"]
  E --> F["6. Review<br/>brief + export"]
1.Import. A SaaSquatch-style CSV or a plain list of website addresses.
2.Clean. Normalize domains, remove exact duplicates, and flag near-duplicate names with fuzzy matching.
3.Fetch. Read the home, about, and contact pages, respecting robots.txt and pausing between requests to the same site. Check that the domain can receive email.
4.Extract and verify. Claude pulls out facts with a supporting quote. Code confirms each quote appears on the fetched page; facts that fail are dropped.
5.Score. Rate acquisition fit and how much evidence backs the rating (next section). Compare against the imported data and flag conflicts, such as the CSV saying 40 employees while the site suggests three.
6.Review and export. A ranked table, an evidence panel per company with the source sentences, a short call brief, and a CRM-ready CSV export.
Scoring
Each lead gets a fit score from 0 to 100 and a separate evidence level, so a high score built on thin information is visibly different from one backed by confirmed facts. The weights below are a starting proposal for you to adjust.
Signal	Weight	What earns points
Owner-operated	25	A named owner or founder on the site
Years in business	20	Longer history, up to about 25 years
Single or few locations	20	Not a franchise or chain
Size fit	15	Team size in the target range
Reachability	10	Working phone plus a named or domain-verified email
Data consistency	10	Site agrees with the imported CSV
Evidence level is the share of these signals that have a verified source quote: high (5-6), medium (3-4), low (0-2). A signal with no evidence scores zero and shows "not found".
This is a heuristic built only from public web pages. The README and video will say so plainly.
Stack and architecture
The handbook asks for the exact database, caching, hosting, deployment, and cloud provider, so each is named here.
Layer	Choice	Why
App	Next.js (App Router), TypeScript, Tailwind, shadcn/ui	One codebase for UI and API, fast to polish
Database	Postgres on Neon, with Drizzle ORM	Real relational storage; pg_trgm for fuzzy duplicate matching
Caching	Results table keyed by domain with a time-to-live	Skips re-fetching, keeps demos fast, no extra service
Fetching	fetch plus cheerio, robots.txt check, per-site delay, retries	Polite and stable
AI	Claude API for extraction, score reasons, and call briefs	Matches Caprae's AI-readiness theme
Hosting	Vercel (serverless)	Deploys from GitHub, gives a live demo link
Cloud	Vercel and Neon (both run on AWS)	Simple setup, no servers to manage
Long fetches run per company in small batches so no single request hits a serverless time limit, and the page shows live progress.
5-hour schedule
The handbook caps the build at 5 hours, so the README and video script are written as we go, not at the end.
Block	Time	Work
1	0:30	Finalize the data model and scoring weights; study the SaaSquatch demo again
2	0:45	Schema, CSV import, dedupe
3	1:30	Fetching, Claude extraction, quote check, email-domain check, cache
4	0:45	Scoring, conflict flags, call briefs
5	1:00	Interface: ranked table, filters, evidence panel, export
6	0:30	Seed demo data, deploy, README, record video
Total: 5 hours. If we run behind, the call briefs and the second data source are the first things to trim.
Handbook fit
The plan covers all five scoring areas, and the weakest is multiple data sources, which the second source below is meant to close.
Criterion	Points	How the plan answers it
Business use case	10	Targets acquisition sellers like Caprae's own searchers; removes bad data; call briefs and CRM-ready export fit existing workflows
UX/UI	10	One guided flow of import, review, export; an evidence panel makes verifying a lead a single click
Technicality	10	Deduplication, enrichment, email-domain validation, caching, polite fetching; second source (public map data or a business listing) to cross-check name, address, and phone
Design	5	Table-first layout, clear score and evidence badges, consistent type and color
Other	5	Ethical fetching, batch summary line (for example "31 of 50 verified, 9 look like chains"), CRM-ready export, clear README
The handbook also asks for a GitHub repo with a README and dataset, a video under 2 minutes, and a written UX and backend rationale. The stack table above doubles as that rationale.
Out of scope and risks
We cut anything that does not serve the verify-and-rank loop, and the README will say how each cut would be added later.
Not building: user accounts and teams, a job queue, Redis, CAPTCHA or proxy handling, live discovery of new companies, and guessing personal email addresses. We will not bypass sites that block scrapers.
Risks and how we handle them:
•Thin websites. Many small businesses list little. The tool shows evidence level and "not found" instead of hiding gaps.
•Live fetch failing on camera. The demo uses about 30 pre-verified real businesses; live verification of one new domain is a bonus button with clean error messages.
•AI making things up. Every fact needs a quote that the code confirms is on the page.
•Heuristic scoring. Weights are a judgment call, so the doc, README, and video state that plainly.
•Similar candidate projects. Other submissions score leads, so the verification angle and the quote check must be the visible centerpiece.