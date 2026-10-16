# Kolkata Hiring Map — Fetcher (Python / Django)

A small service that runs next to the Laravel site on the VPS and does two
nightly jobs:

1. **`fetch_jobs`** — finds new jobs. For every company on the map that has an
   job board (Freshteam, Darwinbox, Keka, Zoho Recruit, Greenhouse, Lever,
   Ashby, Workable, Recruitee) or a careers page,
   it reads the jobs, keeps the Kolkata ones, and sends them to the site.
2. **`check_links`** — the nightly link check (same rules as
   `php artisan postings:check`), if you hand it over with `LINK_CHECKER=python`.

```
            ┌──────────── VPS ─────────────────────────────────────────┐
 ATS APIs   │  fetcher/ (Django)            Laravel site                │
 careers ──►│  fetch_jobs  ──POST /api/ingest/jobs──►  pending          │
 pages      │                                          submissions ──► /dashboard (you approve)
            │  check_links ──GET  /api/ingest/postings                  │
            │              ──POST /api/ingest/checks──► strikes / close │
            └───────────────────────────────────────────────────────────┘
```

**The site stays in charge.** The fetcher never puts anything on the map by
itself:

| What the fetcher finds | What Laravel does |
|---|---|
| A job not on the map yet | Adds it to **Pending submissions** on `/dashboard`, tagged `auto · greenhouse` etc. "Add as opening" pre-fills the form |
| A job that's already on the map | Refreshes "last seen" — being on the company's own board is proof it's live |
| A job you already approved or rejected | Skips it — nothing is ever re-queued after a person has looked at it |
| A job whose posting was closed | Skips it — closed postings aren't revived |

## Telling it which companies to scan

Nothing to configure here — it asks the site. Set each company's sources on
`/dashboard` → **Job sources** (or in the "Add company" form). Paste the
company's job board link and the provider + token fill in automatically:

- `ats_provider` + `ats_token` — e.g. `greenhouse` + `acme` for
  `boards.greenhouse.io/acme`. The token is the slug in the company's job board URL:

  | Provider | Board URL looks like | Token |
  |---|---|---|
  | greenhouse | `boards.greenhouse.io/acme` or `job-boards.greenhouse.io/acme` | `acme` |
  | lever | `jobs.lever.co/acme` | `acme` |
  | ashby | `jobs.ashbyhq.com/acme` | `acme` |
  | workable | `apply.workable.com/acme` | `acme` |
  | recruitee | `acme.recruitee.com` | `acme` |
  | freshteam | `acme.freshteam.com/jobs` | `acme` |
  | darwinbox | `acme.darwinbox.in/ms/candidatev2/…` | `acme` |
  | keka | `acme.keka.com/careers` | `acme` |
  | zohorecruit | `acme.zohorecruit.in/jobs/Careers` | `acme.zohorecruit.in` — the **whole host** (`.in` and `.com` can be different organisations) |

  Most Kolkata employers use the last four (Indian HR suites) rather than the
  first five. Those four don't publish an official API: the adapters read the
  same feed each careers site loads in the browser, so a vendor redesign can
  break one — `docker compose logs fetcher` shows the error for that company.

- or just `careers_url` — the fetcher reads any schema.org `JobPosting` data
  embedded in that page (the markup Google for Jobs uses). Pages without it
  return nothing; robots.txt is respected.

## What gets kept

Jobs whose location mentions Kolkata or a Kolkata locality (Salt Lake, Sector V,
New Town, Rajarhat, Howrah, …; full list in `ingest/normalize.py`). Remote-only
and no-location jobs are dropped unless you set `INCLUDE_REMOTE=true` /
`INCLUDE_UNKNOWN_LOCATION=true`. The experience level is guessed from the title
(Intern / Fresher / 1-3 yr / 3+ yr) as a starting point for the moderator.

**Legal note:** this only reads public ATS job-board APIs, the public job
feeds behind companies' own careers sites, and companies' careers pages.
Don't add adapters that scrape Naukri, LinkedIn, Indeed etc. — their terms
forbid it.

---

## Running it

It runs as the `fetcher` service in the project's Docker Compose stack — setup
is in [../DEPLOY.md](../DEPLOY.md). Only `SECRET_KEY` needs setting in
`fetcher/.env`; Compose supplies the site address (`http://caddy:8080`, an
internal address that serves only `/api/ingest`), the shared `INGEST_API_TOKEN`
and the history database (SQLite in the `fetcher_data` volume).

The container runs [supercronic](https://github.com/aptible/supercronic) with
[`deploy/crontab`](deploy/crontab): `fetch_jobs` at 02:30 IST and `check_links`
at 03:30 IST. Compose sets `LINK_CHECKER=python` on the site so Laravel's own
`postings:check` stays off and dead links don't get two strikes a night.

```bash
docker compose exec fetcher python manage.py fetch_jobs --dry-run   # fetch + print, send nothing
docker compose exec fetcher python manage.py fetch_jobs             # for real
docker compose exec fetcher python manage.py check_links
docker compose logs -f fetcher                                      # what the nightly runs did
```

Options: `fetch_jobs --company acme`, `--provider lever`, `--delay 2`.

### History admin (optional)

Every run and every job it saw is browsable in the Django admin. It only
listens on the server itself (127.0.0.1:8001); reach it over an SSH tunnel:

```bash
docker compose exec fetcher python manage.py createsuperuser   # once
docker compose --profile admin up -d fetcher-admin
# from your PC:
ssh -L 8001:127.0.0.1:8001 you@your-vps     # then open http://localhost:8001/admin/
```

## Checking it works

- `/dashboard` → Pending submissions shows `auto · …` items after a fetch.
- "Last link check …" on `/dashboard` updates every morning.
- `docker compose logs fetcher` lists any company whose board failed (wrong token, site down).

## Development

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
DEBUG=true .venv/bin/python manage.py test
```

No Python on your PC? Use the Docker image:

```bash
docker compose run --rm -e DEBUG=true fetcher python manage.py test
```

| File | What it is |
|---|---|
| `ingest/sources/*.py` | One adapter per job source — add new ones here and in `sources/__init__.py` |
| `ingest/normalize.py` | Kolkata filter, experience/work-mode guessing |
| `ingest/linkcheck.py` | Link probe (keep `DEAD_PHRASES` in sync with `CheckJobPostings.php`) |
| `ingest/services.py` | The fetch and link-check runs |
| `ingest/laravel.py` | Client for the site's `/api/ingest/*` |
| `../web/app/Http/Controllers/IngestController.php` | The other end of that API |
