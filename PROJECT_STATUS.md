# Kolkata Hiring Map — Project Status

_Last updated: 2026-10-16_

A public map of who is hiring in Kolkata, where, and at what pay. It is a
**discovery layer, not a job portal**: no applications, no resumes, no
candidate accounts. Every role links out to where it was actually posted.

**Status: code is launch-ready. Launch is blocked only on server setup (§5) and content (§6).**

---

## 1. Tech stack

| Layer | What we use | Notes |
|---|---|---|
| Backend | Laravel 12 (PHP), in `web/` | PHP-FPM behind Caddy (automatic HTTPS) |
| Hosting | Docker Compose on one VPS | Services: caddy, app, scheduler, mysql, fetcher — see [DEPLOY.md](DEPLOY.md) |
| Job fetcher | Python 3.12 + Django 5.2 (`fetcher/`) | Its own container. Talks to Laravel over the private Docker network through `/api/ingest/*` — see [fetcher/README.md](fetcher/README.md) |
| Frontend | Inertia.js + React 18 + Tailwind | Built inside the Docker image (`npm run build`) |
| Database | MariaDB container (XAMPP MySQL also works for local dev) | Tests run on in-memory SQLite |
| Map | Leaflet + Esri Canvas tiles + marker clustering | Esri tiles need no API key |
| Fonts | Anek Latin (headings), Manrope (body) | Google Fonts |

---

## 2. What we have (built and working)

### Public site

| Page | What it does |
|---|---|
| `/` Map | Pins with live role counts, clustering, search, filter chips (internships / freshers / this week), sector/type/experience filters, "Hiring by area" rail, company side panel with job cards and "Open posting" links |
| `/openings` | Flat list of every live role, newest first, filters, pagination, expandable company info |
| `/company/{slug}` | Company profile + its open roles |
| `/area/{key}` | Companies in one area (18 Kolkata hubs seeded) |
| `/sector/{key}` | Companies in one sector |
| `/submit` | Public form to suggest a company or opening — goes to moderation, never straight to the site |
| `/about` | What the product is and isn't |
| `/sitemap.xml`, `/robots.txt` | SEO |

Also: light/dark theme (remembered per visitor), mobile layout, SEO meta
tags on every page, verified ✓ badge, company logo fallback via favicon.

### Admin (moderation) — `/dashboard`

Only users with admin access can open it. Log in at `/login`.

- **Pending submissions** — "Add as company/opening" (prefills the form), "Mark done", or "Reject"
- **Postings needing attention** — failed link checks or not confirmed in 14+ days; "Still live" or "Close"
- **Add to the map** — forms to add a company or an opening directly
- **Job sources** — set where the fetcher looks for each company's jobs (paste a Freshteam/Darwinbox/Keka/Zoho Recruit/Greenhouse/Lever/Ashby/Workable/Recruitee board link and the provider + token fill in, or a careers page URL)
- Stats: pending submissions, live postings, postings needing attention, companies, last link-check run

### Automatic freshness check (needs cron — see §4)

`php artisan postings:check` runs nightly at 3:30 AM and re-checks every live
posting's link. Working links stay up; links dead two nights running are closed.
With `LINK_CHECKER=python` the Python fetcher runs the same check instead.

### Automatic job fetching (Python, `fetcher/`)

`python manage.py fetch_jobs` reads company ATS boards (Greenhouse, Lever,
Ashby, Workable, Recruitee, and the Indian HR suites Freshteam, Darwinbox, Keka,
Zoho Recruit) and careers-page JobPosting markup, keeps Kolkata
jobs, and queues new ones as **Pending submissions** tagged `auto · <source>`.
Jobs already on the map get their "last seen" refreshed. Nothing goes live
without a moderator.

### Security and safety

- Submit form: rate limit (5/min) + hidden honeypot field against bots
- Submitter emails stored only as a one-way hash
- Public sign-up disabled; admin pages need `is_admin` (cannot be set through any form)
- Internal fields (`ats_token` etc.) never sent to the browser
- In production: https forced (when `APP_URL` is https), `migrate:fresh` / `db:wipe` blocked
- Admin seeding never uses a default password

### Data

- **20 real, individually verified Kolkata companies** (`php artisan seed:verified`)
- **5 confirmed live roles** (Mihup, ITC, Indus Net Technologies, Vikram Solar, Lumino Industries)
- 18 Kolkata hiring areas

### Tests

**78 Laravel tests** (`php artisan test`) — every public page, submissions +
spam protection, admin access and actions, link checker, ingest API.
**37 Python tests** (`python manage.py test` in `fetcher/`) — every source
adapter, Kolkata filter, link probe, fetch and check runs. All passing.

---

## 3. What was fixed on 2026-09-23

**Bugs**
- Every posting would have vanished ~3 weeks after launch (nothing refreshed "last seen") → nightly link check
- Body font resolved to Figtree (never loaded) instead of Manrope
- Map logo fallback never worked (company website wasn't sent to the map)
- Header Map/List toggle highlighted "Map" on unrelated pages
- Job submissions could be sent without a role
- Mobile "Areas" button covered the company panel
- Empty clusters showed a green "0"
- Browser tab title showed the site name twice
- "We re-scan weekly" claim that wasn't true

**Added**
- Moderation dashboard, link checker, admin commands, production config template, deploy guide
- UI polish: hover/press/focus states on all buttons, search clear button, filter count on Reset, Esc closes panels, better forms and empty states

---

## 4. The cron job (required)

A cron job is a timer that runs a command on a schedule. Under Docker the
containers keep the schedule themselves — no server crontab.

**Why it's required:** the site only shows postings confirmed live within the
last **21 days**. The nightly link check is what re-confirms them. Without the
cron job, **every posting disappears about 3 weeks after launch**.

**What the nightly check does:**

| Link check result | What happens |
|---|---|
| Page opens fine | Stays on the site, confirmed today |
| 404 / "no longer accepting applications" | One strike; **two nights in a row → closed** |
| Blocked / timeout / server error | No change; shows on dashboard for a manual check if it persists |

**Setup** — none. The `fetcher` container runs the link check at 03:30 IST (and the job fetch at 02:30); the `scheduler` container runs Laravel's schedule.

**Check it works:** next day, `/dashboard` shows "Last link check … N checked".

Full details and troubleshooting: [CRON.md](CRON.md).

---

## 5. What's left before launch — only you can do these

- [ ] **VPS with Docker** (2 GB RAM), domain DNS pointing at it, ports 80/443 open
- [ ] **Three settings files:** `.env` (domain, DB passwords, `INGEST_API_TOKEN`), `web/.env` from `web/.env.production.example` (**`APP_DEBUG=false`**, `APP_KEY`, real SMTP), `fetcher/.env` (`SECRET_KEY`)
- [ ] **`docker compose up -d --build`**, then `db:seed --force` and `seed:verified` inside `app`
- [ ] **Admin account:** set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding (or note the printed random password); remove `ADMIN_PASSWORD` afterwards
- [ ] **Backups:** daily database dump (DEPLOY.md §6)
- [ ] **Log in, open `/dashboard`**, confirm it loads
- [x] **Git repo** — https://github.com/loco0011/kolkata-hiring-map

Step-by-step commands: [DEPLOY.md](DEPLOY.md).

---

## 6. Recommended before launch

- **More content.** 5 live roles is thin — most pins will show zero openings.
  Use `/dashboard` → "Add to the map" to add verified companies and roles.
  Every entry should be checked against the real posting; never invent data.
- **Test on a phone** after deploying (map, filters, company panel, submit form).

---

## 7. Known limitations

- **General careers-page links:** some postings link to a company's careers
  page, not the specific job. The link check can only confirm the page is up,
  not that the role is still open — close those by hand.
- **Bot-blocked sites** (e.g. LinkedIn) can't be auto-checked; they surface on
  the dashboard after 14 days and are hidden after 21 unless you confirm them.
- **SSL issues on some sites:** e.g. ITC's careers page failed the check
  locally because PHP couldn't verify its certificate chain. Treated as
  "unknown", not dead. May behave differently on the live server.
- **Logos** come from Google's favicon service when no logo is stored — low resolution for some companies.
- **No server-side rendering** — search engines that don't run JavaScript see
  only the generic site description (fine for Google, weaker for others).
- **Company pins without exact coordinates** sit at their area's centre.

---

## 8. Not built yet (future roadmap)

| Phase | Feature |
|---|---|
| 2 — Ingestion | ~~ATS boards + careers-page JobPosting import~~ — **built** in `fetcher/` (2026-10-16) |
| 2 — Ingestion | AI extraction of roles from unstructured pages, with a review queue |
| — | Self-hosted, resized company logos |
| — | Edit / delete existing companies and postings from the dashboard (currently add + close only) |
| 3 | Email alerts for new roles |
| 4 | Company reviews / salary bands |
| 5 | Programmatic SEO pages (e.g. "fresher jobs in Salt Lake") |

---

## 9. Useful commands

```bash
# the whole stack (from the repo root)
docker compose up -d --build           # start / deploy
docker compose logs -f app             # logs (or caddy, fetcher, scheduler)
docker compose exec app php artisan …  # any artisan command below, on the server

# local development without Docker (cd web)
php artisan serve              # Laravel on :8000
npm run dev                    # Vite hot reload
php artisan test               # run all tests

# database
php artisan migrate            # apply new migrations (the app container does this on start)
php artisan db:seed            # areas + admin account
php artisan seed:verified      # verified companies + postings (safe to re-run)

# admin
php artisan admin:make you@example.com   # give admin access / reset password

# freshness and new jobs (fetcher container)
docker compose exec fetcher python manage.py check_links   # run the link check now
docker compose exec fetcher python manage.py fetch_jobs    # fetch new jobs now
```

---

## 10. Key files

| File | Purpose |
|---|---|
| `docker-compose.yml` | All the services and how they connect |
| `DEPLOY.md` | Step-by-step deploy guide |
| `CRON.md` | Cron job explained + troubleshooting |
| `PROGRESS.md` | Detailed build history and decisions |
| `.env.example`, `web/.env.production.example`, `fetcher/.env.example` | Server config templates |
| `web/Dockerfile`, `web/docker/Caddyfile`, `fetcher/Dockerfile` | Images and web server config |
| `web/app/Console/Commands/CheckJobPostings.php` | Nightly link checker |
| `web/app/Console/Commands/SeedVerifiedCompanies.php` | The verified company/posting data + sources |
| `web/app/Http/Controllers/AdminController.php` | Moderation dashboard backend |
| `web/resources/js/Components/HiringMap.jsx` | The map |
| `web/resources/js/Pages/Dashboard.jsx` | Moderation dashboard UI |
| `web/resources/css/app.css` | Theme colours and all shared UI styles |
| `web/routes/web.php`, `web/routes/console.php` | Pages / scheduled tasks |
