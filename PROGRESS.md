# Kolkata Hiring Map — Progress Log

Living record of what's been built, why it deviated from the original plan, and what's left. Written 2026-08-22.

---

## Stack (deviated from the original plan)

The original build plan specified Astro + Node ingestion workers + PostgreSQL. That changed early:

| Layer | Original plan | Actual | Why |
|---|---|---|---|
| Backend | Astro (static) + Node workers | **Laravel 12** | Hosting plan only supports PHP/MySQL, no Node runtime in production |
| Frontend | Astro islands | **Inertia.js + React 18 + Tailwind** | User's choice — modern UI, no separate API layer, no Node runtime needed at runtime (only at build time) |
| Database | PostgreSQL | **MySQL** (via XAMPP locally) | Matches hosting constraint |
| Map | Leaflet + CARTO | **Leaflet + CARTO** (unchanged) | No reason to change |

Everything else in the original plan's data model (§1) was ported as-is, with one rename: `jobs` → **`job_postings`**, because `jobs` collides with Laravel's own queue table.

---

## Current state: what's built

### Database schema
Five tables, all migrated on MySQL:
- **`companies`** — UUID PK, slug, name, type/sector/size_band enums, area (FK → `areas.key`), lat/lng, `is_verified`, `status`, ATS fields for future ingestion.
- **`areas`** — string PK (`key`), label, lat/lng, seeded with 18 real Kolkata hiring hubs (Salt Lake Sector V, Rajarhat New Town, Park Street, EM Bypass, etc.) via `AreaSeeder`.
- **`job_postings`** — UUID PK, FK to company, title/title_norm (for dedup), exp_bucket, internship/fresher flags, pay fields, source enum, `apply_url` (required, never null), `posted_at`, `status`.
- **`submissions`** — public "add a company/job" form lands here as `pending`, JSON payload, hashed submitter email.
- **`ingest_runs`** — logging table for future scraper/ATS runs (source, counts, errors). Not yet populated — no ingestion built yet.

### Routes & pages
All server-rendered via Inertia, all responsive, all SEO-tagged (canonical, OG, Twitter card):

| Route | Purpose |
|---|---|
| `/` | The map — see below |
| `/company/{slug}` | Company profile + open roles |
| `/area/{key}` | Companies hiring in one area |
| `/sector/{key}` | Companies in one sector |
| `/openings` | Flat, filterable, paginated list of all live roles |
| `/submit` | Public "add a company or opening" form → `submissions` table |
| `/about` | What the product is / isn't |
| `/sitemap.xml` | Dynamic, cached 6h, covers all companies/areas/sectors |
| `/dashboard` (admin) | Moderation: submissions, postings needing attention, add company/opening |

### The map (the core feature)
Ported faithfully from a prototype HTML file the user supplied mid-build, replacing an earlier from-scratch design:
- **Pins** show live opening counts as badges — green border/text normally, orange if the company has internships open, a small marigold dot for postings ≤3 days old, grows + turns marigold on hover/selection.
- **Live pulse counter** in the top bar ("N open roles · M internships"), updates live as filters change.
- **Search** across job titles, company names, and sectors — all client-side over the payload already sent.
- **Filter chips** (Internships / Open to freshers / Posted this week) + sector/type/experience dropdowns + Reset, all client-side.
- **"Hiring by area" rail** — collapsible on mobile, always visible on desktop, green/orange progress bars per area, click to fly the map there.
- **Company sheet** slides in from the right on pin/rail click — logo, address/type/sector (deduped so a company can't show "Media · Media" twice), job cards with tags (internship/freshers/experience/pay), source + relative time, "Open posting ↗" linking to each job's real `apply_url`.
- **Light/dark theme toggle** — sun/moon button in the header, persisted to `localStorage`, applied via a `data-theme` attribute on `<html>` with an anti-flash inline script so there's no flash of the wrong theme on reload. The Leaflet tile layer itself swaps between CARTO's `dark_all` and `light_all` styles to match.

### Design system
- Palette: deep teal/navy dark theme (`#0B1A22` bg, marigold `#F5A524` accent, green/orange signal colors for live/internship) with a warm off-white light theme counterpart — both driven entirely by CSS custom properties in `resources/css/app.css`, so the toggle just flips one `data-theme` attribute.
- Fonts: Anek Latin (headings), Manrope (body) — via Google Fonts. (The brand mark previously had a bilingual Bengali subtitle — removed 2026-09-10.)
- Shared component classes (`.khm-card`, `.khm-btn`, `.khm-heading`, `.chip`, `.tag`, etc.) reused across every content page for consistency.

### `/openings` — inline expand
Clicking a company name in the flat openings list expands an inline panel (type/sector/size, address, website link, "view full company page" link) instead of immediately navigating away. Chevron rotates to show state, one row expands at a time.

### Seed data — real, not fabricated (as of 2026-09-10)
The original dummy dataset (30 fake companies, synthetic non-functional `apply_url`s) was replaced ahead of launch. `php artisan seed:verified` (renamed from `seed:dummy`) now seeds **20 individually-verified real Kolkata companies**, each confirmed via web search plus a live fetch of its actual careers page (or a job board page linking to one), with real `apply_url`s and `is_verified = true`. Only **5 have a specific currently-live job posting confirmed** (Mihup, ITC, Indus Net Technologies, Vikram Solar, Lumino Industries) — the rest show with zero open roles rather than a fabricated one; that's honest, not a bug. See `app/Console/Commands/SeedVerifiedCompanies.php` for the full list and per-company sourcing.

This is intentionally a *much smaller* dataset than the old fake one (5 real live roles vs. 41 invented ones) — real, checked data doesn't scale as fast as invented data, and that's the point. Expanding coverage (more companies, more confirmed live roles) is ongoing research work, not something to script. The `data/seed/companies.csv` pipeline (`php artisan seed:companies`) remains available for bulk-importing further verified companies once researched, but does not yet import job postings.

Note: `seed:verified` is **not** wired into `DatabaseSeeder` — `DatabaseSeeder` runs under `WithoutModelEvents`, which silently disables the `creating` hook that generates UUID primary keys (`HasUuidPrimaryKey`) and breaks inserts. Run it as a separate step after `db:seed` (see Useful commands below).

### Production-readiness pass (2026-09-10)
- **Fixed a broken core feature**: the map's CARTO basemap tiles now require an API key and were rendering "API KEY REQUIRED" watermarks instead of an actual map. Swapped to Esri's free, no-key Canvas basemap (`World_{Light,Dark}_Gray_Base` + `_Reference` label layers) — see `HiringMap.jsx`.
- **Added marker clustering** (`leaflet.markercluster`) so dense hiring hubs (Sector V, Rajarhat) render as legible cluster badges instead of overlapping pins.
- **Security**: `Company.ats_token` (a future ingestion credential) was fillable but not hidden, so `CompanyController::show` would have leaked it to every visitor via Inertia the moment ingestion populated it — now hidden. Added rate limiting (`throttle:5,1`) and a honeypot field to the public `/submit` endpoint. Disabled public self-registration (`/register`) — this product has no candidate/employer account use case per the About page's own promise, and an open signup route was needless surface area; login stays open for the seeded admin.
- **Added a "Verified" badge** (✓) on the map sheet and company page, shown when `is_verified = true` — meaningful now that seed data actually is verified.
- **Corrected the About page**, which claimed automated two-strike listing-freshness checks that were never built (Phase 2 ingestion doesn't exist yet).
- **Test coverage**: added `tests/Feature/PublicPagesTest.php` and `tests/Feature/SubmissionTest.php` (42 tests total, previously only Breeze's default auth tests existed) — covers every public route, 404 behavior, the ats_token leak, and the full submission/validation/honeypot/throttle flow. Fixed `ExampleTest` (RefreshDatabase was commented out, so `GET /` 500'd against an unmigrated in-memory SQLite DB).
- Added `Company`/`JobPosting` factories (didn't exist).
- Cleaned up a stale `public/hot` file left by a killed `vite dev` process, which was silently forcing the production build to load JS from a dead `localhost:5173` instead of `public/build`.

### UI polish pass (2026-09-23)
- Buttons/chips/selects got hover, press and keyboard focus states; the `.khm-select` padding no longer overlaps the forms plugin's caret.
- Map: search icon + clear button, chips show colour dots, active selects are highlighted, Reset shows how many filters are on (and is disabled when none are), Esc closes the sheet, sheet links to the company profile, mobile "Areas" button hides while the sheet is open.
- Submit form: segmented company/job picker, labelled fields with per-field errors, loading state. `role` is now required for job submissions (server-side).
- `/openings` and company pages: tags for experience/work mode/pay, "posted N ago", favicon logo fallback, proper empty states. Shared helpers live in `resources/js/lib/format.js`.
- Fixes: `<body class="font-sans">` resolved to Figtree (never loaded) instead of Manrope; `MapController` didn't send `website`, so the map's favicon fallback never worked; the header Map/List pill highlighted "Map" on pages that are neither; zero-job clusters showed a green "0".

### Launch-readiness pass (2026-09-23)
- **Moderation dashboard** at `/dashboard` (admin-only via `users.is_admin` + `admin` middleware): pending submissions (add as company/opening with prefill, mark done, reject), postings needing attention (confirm still live / close), and forms to add companies and openings directly. Non-admin logged-in users get 403.
- **Link checker** `php artisan postings:check`, scheduled nightly at 03:30: refreshes `last_seen_at` on live links, two consecutive dead results (404/410 or "no longer accepting applications"-style text) close a posting, bot walls/timeouts/5xx change nothing. Logs each run to `ingest_runs` (source `closure`). Without this, `scopeLive()`'s 21-day window would have hidden every posting ~3 weeks after launch. **Requires the cron entry in DEPLOY.md.**
- **Admin account**: `db:seed` no longer creates the admin with Laravel's default `password`; it uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` or prints a random one. `php artisan admin:make {email}` promotes an existing user and optionally resets the password.
- **Production**: `.env.production.example` + `DEPLOY.md` checklist; in production, https is forced when `APP_URL` is https and destructive DB commands (`migrate:fresh`, `db:wipe`) are blocked.
- Removed the false "we re-scan weekly" line from the map sheet; About page now describes the nightly check accurately. Fixed doubled site name in the browser tab title.
- Known limitation: postings whose `apply_url` is a general careers page can only be verified as "page is up", not "this role is still open" — close those by hand.

---

## Bugs found and fixed along the way

1. **Leaflet z-index burying UI overlays** — Leaflet's internal panes carry high inline `z-index` values that sat above the area panel and company sheet. Fixed with explicit `z-[1000]`/`z-[1100]` on our overlays.
2. **`jobs` table name collision** — Laravel's queue system already owns a `jobs` table (`QUEUE_CONNECTION=database`). Renamed our model/table to `JobPosting`/`job_postings` before it caused a migration conflict.
3. **MySQL strict-mode timestamp defaults** — `$table->timestamp(...)` without a default fails under strict SQL mode; switched `first_seen_at`/`last_seen_at`/`started_at`/`finished_at` to `dateTime()`.
4. **Carbon 3 signed `diffInDays()`** — Laravel 12 ships Carbon 3, which changed `diffInDays()` to return *signed* values by default instead of always-positive. `now()->diffInDays($pastDate)` was coming out **negative**, which silently broke "days since posted" display, the "posted this week" filter, and the "new" pin marigold dot. Fixed by calling `diffInDays()` from the earlier date with `absolute: true`.
5. **Company `type`/`sector` duplicate display** — one seeded company (hoichoi) had `type` and `sector` both set to "Media", so several places on the site showed "Media · Media". Fixed the seed data and made every place that joins `type`/`sector`/`size_band` dedupe with `[...new Set(...)]` so it can't silently recur.

---

## Not built yet

Everything from the original plan's **Phase 2 (Ingestion)** onward:
- ATS pollers (Greenhouse/Lever/Ashby/Workable/Recruitee)
- JSON-LD `JobPosting` scraper + change-detection
- Claude Haiku extraction path with confidence-gated moderation queue
- Logo pipeline (self-hosted, resized) — currently falls back to Google's favicon service per-company when no `logo_url` is set
- Email alerts (Phase 3), reviews/salary bands (Phase 4), programmatic SEO pages (Phase 5)

---

## Useful commands

```bash
# Run all migrations fresh
php artisan migrate:fresh

# Seed areas + the admin user (uses ADMIN_EMAIL / ADMIN_PASSWORD, or prints a random password)
php artisan db:seed

# Then, separately (see note above on why this isn't chained into db:seed):
# seed real, verified companies + their live job postings (idempotent, safe to re-run)
php artisan seed:verified

# Import real companies from data/seed/companies.csv (currently header-only)
php artisan seed:companies

# Build frontend assets
npm run build

# Local dev servers
php artisan serve          # Laravel, defaults to :8000
npm run dev                # Vite HMR, :5173 — Laravel auto-detects via public/hot
```
