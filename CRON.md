# Cron job — what it does and how to set it up

## What is a cron job?

A cron job is a timer on the hosting server that runs a command automatically
on a schedule — like an alarm clock for the server.

## What it does in this project

The cron entry runs this every minute:

```
php artisan schedule:run
```

That asks Laravel "is anything due right now?". Almost every minute the answer
is no and it exits in a fraction of a second. Once a day at **3:30 AM** the
answer is yes, and it runs the link checker:

```
php artisan postings:check
```

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

Most PHP hosts (cPanel, Hostinger, etc.) have a **"Cron Jobs"** section in the
control panel. Add one entry:

- **Schedule:** every minute — `* * * * *`
- **Command:**

  ```
  cd /path/to/your/app && php artisan schedule:run >> /dev/null 2>&1
  ```

Replace `/path/to/your/app` with the folder the project lives in on the server
(the one containing `artisan`).

### If your host doesn't allow every-minute cron

Skip the scheduler and run the link checker directly once a day instead:

```
30 3 * * * cd /path/to/your/app && php artisan postings:check >> /dev/null 2>&1
```

### If `php` isn't found

Some hosts need the full path to PHP, e.g. `/usr/local/bin/php` or
`/opt/cpanel/ea-php83/root/usr/bin/php`. Your host's docs or support can tell
you the right one.

### Handing the link check to the Python fetcher

If the Python fetcher (`fetcher/`) is set up, it can run the same check
(`python manage.py check_links`) and report results back to the site. Set
`LINK_CHECKER=python` in the Laravel `.env` so `schedule:run` stops running
`postings:check`; otherwise every dead link gets two strikes a night. Keep the
`schedule:run` cron entry either way. The fetcher's own cron entries are in
[fetcher/README.md](fetcher/README.md).

## Checking that it works

- The day after setting it up, open `/dashboard`. It should say
  **"Last link check … N checked, M closed"**.
- If it still says the check has never run, the cron entry isn't working —
  check the path to the app and to PHP.
- You can always run it by hand over SSH to see the output:

  ```
  php artisan postings:check
  ```

## Things the check can't do

Some postings link to a company's **general careers page** rather than the
specific job. For those, the checker can only confirm the page is up — not that
that particular role is still open. Close those by hand from `/dashboard` when
the role is gone.
