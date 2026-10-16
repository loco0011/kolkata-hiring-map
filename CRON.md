# Cron job — what it does and how to set it up

## What is a cron job?

A cron job is a timer that runs a command automatically
on a schedule — like an alarm clock for the server.

## What it does in this project

Under Docker there is no server crontab to set up. Two containers keep time
themselves:

| Container | Schedule | Runs |
|---|---|---|
| `fetcher` | 02:30 IST | `python manage.py fetch_jobs` — new jobs into `/dashboard` pending submissions |
| `fetcher` | **03:30 IST** | `python manage.py check_links` — the link checker |
| `scheduler` | every minute | `php artisan schedule:run` — Laravel's own schedule |

The fetcher's times are in [`fetcher/deploy/crontab`](fetcher/deploy/crontab)
(written in UTC). Laravel also has a link checker, `php artisan postings:check`;
Compose sets `LINK_CHECKER=python`, so only the fetcher's runs and a dead link
gets one strike a night, not two.

The link checker visits every live job posting's link:

| What it finds | What happens |
|---|---|
| Page opens fine | Posting is marked "confirmed today" and stays on the site |
| Page is gone (404/410), or says "no longer accepting applications" | One strike. **Two nights in a row → posting is closed automatically** |
| Site blocks the check, times out, or has a server error | Nothing changes. If it keeps happening, the posting appears on `/dashboard` under "Postings needing attention" for a manual check |

Every run is logged, and the dashboard shows "Last link check …" at the top.

## Why it matters

The site only shows postings confirmed live within the last **21 days**, so
dead jobs don't linger forever. Without the cron job nothing re-confirms them,
and **every posting disappears from the map about 3 weeks after launch**.

With it, working postings stay up and dead ones are removed automatically.

## How to set it up

Nothing to do beyond `docker compose up -d` ([DEPLOY.md](DEPLOY.md)). To change
the times, edit `fetcher/deploy/crontab` and run
`docker compose up -d --build fetcher`.

## Checking that it works

- The day after setting it up, open `/dashboard`. It should say
  **"Last link check … N checked, M closed"**.
- If it still says the check has never run, look at the fetcher's log:
  `docker compose logs fetcher`.
- You can always run it by hand over SSH to see the output:

  ```
  docker compose exec fetcher python manage.py check_links
  ```

## Things the check can't do

Some postings link to a company's **general careers page** rather than the
specific job. For those, the checker can only confirm the page is up — not that
that particular role is still open. Close those by hand from `/dashboard` when
the role is gone.
