# Deploying Kolkata Hiring Map

The host runs PHP + MySQL only (no Node), so the frontend is built **locally** and
`public/build/` is uploaded along with the code.

## 1. Build locally

```bash
npm ci
npm run build          # produces public/build/ — upload this
```

Make sure `public/hot` does **not** exist before uploading (it's left behind by
`npm run dev` and makes the site try to load JS from localhost).

## 2. Server `.env`

Copy `.env.production.example` to `.env` on the server and fill in the blanks. The ones that matter:

| Key | Value | Why |
|---|---|---|
| `APP_ENV` | `production` | Enables the production safeguards in `AppServiceProvider` |
| `APP_DEBUG` | `false` | **Critical.** `true` shows stack traces and config to visitors on any error |
| `APP_URL` | `https://your-domain` | Used for the sitemap, canonical URLs, and forcing https |
| `APP_KEY` | run `php artisan key:generate` | |
| `LOG_LEVEL` | `error` | |
| `DB_*` | your MySQL credentials | |
| `MAIL_*` | real SMTP | Otherwise password-reset emails are never sent |
| `SESSION_SECURE_COOKIE` | `true` | Only once the site is on https |

## 3. Install and migrate

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan db:seed --force       # areas + admin account (see below)
php artisan seed:verified          # the verified companies + postings
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Re-run the three `*:cache` commands after every deploy or `.env` change.

### Admin account

`db:seed` creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. If
`ADMIN_PASSWORD` is blank it generates a random password and prints it **once**.
Delete `ADMIN_PASSWORD` from `.env` afterwards.

For a database that already has a user, promote it (and set a new password) with:

```bash
php artisan admin:make admin@your-domain
```

Log in at `/login`; moderation is at `/dashboard`.

## 4. Cron (required)

Full explanation and troubleshooting: [CRON.md](CRON.md).

The nightly link check (`postings:check`) keeps live postings on the site and
closes dead ones. Without it, **every posting disappears 21 days after it was
last confirmed**. Add this single cron entry in your hosting panel:

```
* * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1
```

Check it's working: the dashboard shows "Last link check …". You can also run it by hand:

```bash
php artisan postings:check
```

## 4b. Job fetcher (Python, optional but recommended)

`fetcher/` is a small Django service that finds new jobs on company ATS boards
and careers pages and puts them in the dashboard's **Pending submissions**. It
can also take over the nightly link check. It runs on the same VPS with its own
cron entries. Setup is in [fetcher/README.md](fetcher/README.md). On the Laravel
side you only add `INGEST_API_TOKEN` (and optionally `LINK_CHECKER=python`) to
`.env`, then re-run `php artisan config:cache`.

## 5. After launch

- Check `/dashboard` regularly for pending submissions and postings that need attention.
- Postings that link to a general careers page (not a specific job page) can't be
  auto-verified beyond "the page is up", so close them by hand when the role goes.
