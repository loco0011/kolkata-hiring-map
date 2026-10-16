# Deploying Kolkata Hiring Map

Everything runs in Docker on one VPS, as separate services from
[`docker-compose.yml`](docker-compose.yml):

| Service | What it is |
|---|---|
| `caddy` | Web server. The only thing exposed to the internet; gets and renews the HTTPS certificate itself |
| `app` | The Laravel site (`web/`) on PHP-FPM. Runs database migrations when it starts |
| `scheduler` | Laravel's scheduler (same image as `app`) |
| `mysql` | MariaDB. Data lives in the `mysql_data` volume |
| `fetcher` | The Python job fetcher (`fetcher/`): new jobs at 02:30 IST, link check at 03:30 IST |
| `fetcher-admin` | Optional: browsable fetch history, only when you ask for it |

The fetcher talks to the site over Compose's private network
(`http://caddy:8080`, which serves only `/api/ingest`). The public site returns
404 for `/api/ingest`, so that API never faces the internet.

The frontend is built inside the image — no Node or PHP needed on the server.

## 1. Server

Any VPS with **2 GB RAM** (the stack uses about 250 MB; the rest is headroom
for building images) running Ubuntu/Debian. Point your domain's DNS **A record**
at the server, then:

```bash
curl -fsSL https://get.docker.com | sh       # Docker + the compose plugin
sudo usermod -aG docker $USER                # log out and back in after this
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

git clone https://github.com/loco0011/kolkata-hiring-map.git
cd kolkata-hiring-map
```

## 2. Settings — three files

```bash
cp .env.example .env                                   # Compose: domain, DB, shared token
cp web/.env.production.example web/.env               # Laravel
cp fetcher/.env.example fetcher/.env                   # fetcher
```

**`.env`** (next to `docker-compose.yml`)

| Key | Value |
|---|---|
| `SITE_ADDRESS` | your domain, e.g. `hiringmap.in` — Caddy fetches the certificate for it |
| `APP_URL` | `https://hiringmap.in` |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | `openssl rand -base64 24` (each) |
| `INGEST_API_TOKEN` | `openssl rand -base64 32` |

The database settings, `INGEST_API_TOKEN` and `APP_URL` are passed to Laravel
and the fetcher from here, so they're set once.

**`web/.env`** — the ones that matter:

| Key | Value | Why |
|---|---|---|
| `APP_KEY` | `echo "base64:$(openssl rand -base64 32)"` | Encrypts sessions and cookies |
| `APP_ENV` | `production` | Enables the production safeguards in `AppServiceProvider` |
| `APP_DEBUG` | `false` | **Critical.** `true` shows stack traces and config to visitors on any error |
| `MAIL_*` | real SMTP | Otherwise password-reset emails are never sent |
| `SESSION_SECURE_COOKIE` | `true` | The site is on HTTPS |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your admin login | Only for the first seed — delete afterwards |

(`DB_*`, `LOG_CHANNEL`, `INGEST_API_TOKEN` and `LINK_CHECKER` in this file are
ignored: Compose sets them.)

**`fetcher/.env`** — set `SECRET_KEY` (`openssl rand -base64 48`). Leave
`LARAVEL_BASE_URL`, `INGEST_API_TOKEN` and `DATABASE_URL` alone: Compose sets them.

## 3. Start it

```bash
docker compose up -d --build
docker compose ps                     # all services "Up"; mysql "healthy"
```

The first start creates the database and runs the migrations. Then load the
starting data (once):

```bash
docker compose exec app php artisan db:seed --force     # areas + admin account
docker compose exec app php artisan seed:verified       # the verified companies + postings
```

`db:seed` creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. If
`ADMIN_PASSWORD` is blank it generates one and prints it **once**. Delete
`ADMIN_PASSWORD` from `web/.env` afterwards and run `docker compose up -d`.

To promote an existing user (and set a new password):

```bash
docker compose exec app php artisan admin:make admin@your-domain
```

Log in at `/login`; moderation is at `/dashboard`.

## 4. Scheduled jobs

Nothing to set up — no server crontab. The `fetcher` container runs the job
fetch and the nightly link check ([`fetcher/deploy/crontab`](fetcher/deploy/crontab)),
and the `scheduler` container runs Laravel's schedule. Without the link check,
**every posting disappears 21 days after it was last confirmed** — see
[CRON.md](CRON.md).

Run either one by hand:

```bash
docker compose exec fetcher python manage.py fetch_jobs --dry-run   # fetch + print, send nothing
docker compose exec fetcher python manage.py fetch_jobs
docker compose exec fetcher python manage.py check_links
```

Tell the fetcher which companies to scan on `/dashboard` → **Job sources**
([fetcher/README.md](fetcher/README.md)).

## 5. Everyday commands

| To… | Run |
|---|---|
| Deploy a new version | `git pull && docker compose up -d --build` |
| Apply a changed `.env` / `web/.env` / `fetcher/.env` | `docker compose up -d` |
| See logs | `docker compose logs -f app` (or `caddy`, `fetcher`, `scheduler`) |
| Run an artisan command | `docker compose exec app php artisan …` |
| Open the fetch history | `docker compose --profile admin up -d fetcher-admin`, then from your PC `ssh -L 8001:127.0.0.1:8001 you@server` and open http://localhost:8001/admin/ (create a login once with `docker compose exec fetcher python manage.py createsuperuser`) |

Config, routes and views are cached every time the containers start, so
there's no `config:cache` step to remember.

## 6. Backups

All data is in Docker volumes. **`docker compose down -v` deletes them** — never
use `-v` on the server.

```bash
# database → file (put this in a daily cron and copy the file off the server)
docker compose exec -T mysql sh -c 'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction "$MARIADB_DATABASE"' > khm-$(date +%F).sql

# file → database
docker compose exec -T mysql sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < khm-2026-10-16.sql
```

## 7. Running it on your PC

The same stack works locally with Docker Desktop. In `.env`, use
`SITE_ADDRESS=:80`, `HTTP_PORT=8000`, `HTTPS_PORT=8443` and
`APP_URL=http://localhost:8000`; then `docker compose up -d --build` and open
http://localhost:8000.

For frontend work with hot reload, run Laravel directly instead (XAMPP MySQL,
`cd web && php artisan serve` and `npm run dev`). Run the tests with
`cd web && php artisan test` and
`docker compose run --rm -e DEBUG=true fetcher python manage.py test`.

## After launch

- Check `/dashboard` regularly for pending submissions and postings that need attention.
- Postings that link to a general careers page (not a specific job page) can't be
  auto-verified beyond "the page is up", so close them by hand when the role goes.
