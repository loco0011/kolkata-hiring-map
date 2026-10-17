#!/usr/bin/env bash
# Deploy (or update) Kolkata Hiring Map on the server.
#
#   ./deploy.sh            pull the latest code, rebuild, restart
#   ./deploy.sh --seed     same, then load the starting data (first deploy only)
#   ./deploy.sh --no-pull  rebuild and restart what's already checked out
#
# On a fresh server it also installs Docker and creates the three .env files
# (with generated secrets), then stops so you can set your domain — see DEPLOY.md.
set -euo pipefail

cd "$(dirname "$0")"

SEED=false
PULL=true
for arg in "$@"; do
    case "$arg" in
        --seed) SEED=true ;;
        --no-pull) PULL=false ;;
        -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
        *) echo "Unknown option: $arg (see ./deploy.sh --help)" >&2; exit 1 ;;
    esac
done

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

# --- 1. Docker -------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    step "Installing Docker"
    command -v curl >/dev/null 2>&1 || { $SUDO apt-get update -qq && $SUDO apt-get install -y -qq curl; }
    curl -fsSL https://get.docker.com | $SUDO sh
    [ -n "$SUDO" ] && $SUDO usermod -aG docker "$USER"
fi

# Until you log out and back in after `usermod`, docker needs sudo
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="$SUDO docker"
$DOCKER info >/dev/null 2>&1 || die "Docker isn't running. Try: sudo systemctl start docker"
$DOCKER compose version >/dev/null 2>&1 || die "The Docker Compose plugin is missing. Install docker-compose-plugin."
compose() { $DOCKER compose "$@"; }

# --- 2. Latest code --------------------------------------------------------
if $PULL; then
    step "Pulling the latest code"
    git diff --quiet && git diff --cached --quiet \
        || die "There are local changes in the checkout. Commit or discard them first (git status)."
    before=$(git rev-parse HEAD)
    git pull --ff-only
    # If this script itself changed, run the new version
    if ! git diff --quiet "$before" HEAD -- deploy.sh; then
        echo "deploy.sh was updated — running the new version"
        exec "$0" --no-pull "$@"
    fi
fi

# --- 3. Settings -----------------------------------------------------------
random() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1" || true; }

# Fill KEY= (blank) in a file with a value
fill() {
    local file=$1 key=$2 value=$3
    grep -q "^$key=$" "$file" && sed -i "s|^$key=$|$key=$value|" "$file"
    return 0
}

created=false
if [ ! -f .env ]; then
    cp .env.example .env
    fill .env DB_PASSWORD "$(random 32)"
    fill .env DB_ROOT_PASSWORD "$(random 32)"
    fill .env INGEST_API_TOKEN "$(random 48)"
    created=true
fi
if [ ! -f web/.env ]; then
    cp web/.env.production.example web/.env
    fill web/.env APP_KEY "base64:$(head -c 32 /dev/urandom | base64)"
    created=true
fi
if [ ! -f fetcher/.env ]; then
    cp fetcher/.env.example fetcher/.env
    fill fetcher/.env SECRET_KEY "$(random 64)"
    created=true
fi

if $created; then
    step "Created the settings files — fill these in, then run ./deploy.sh --seed"
    cat <<'EOF'
  .env         SITE_ADDRESS (your domain) and APP_URL (https://your-domain)
  web/.env     MAIL_* (SMTP), ADMIN_EMAIL, ADMIN_PASSWORD (or leave blank to generate one)
  fetcher/.env nothing required
Passwords, tokens and keys have been generated already.
EOF
    exit 0
fi

grep -q '^APP_KEY=.\+' web/.env || die "APP_KEY is blank in web/.env"

# --- 4. Build and start ----------------------------------------------------
step "Building images"
compose build --pull

step "Starting services"
compose up -d --remove-orphans

step "Waiting for the app"
for _ in $(seq 1 60); do
    compose exec -T app php artisan --version >/dev/null 2>&1 && break
    sleep 2
done
compose exec -T app php artisan migrate:status >/dev/null 2>&1 \
    || die "The app didn't come up. Check: docker compose logs app"

if $SEED; then
    step "Loading the starting data"
    compose exec -T app php artisan db:seed --force
    compose exec -T app php artisan seed:verified
    echo "If you set ADMIN_PASSWORD in web/.env, delete it now and run ./deploy.sh --no-pull"
fi

# --- 5. Tidy up ------------------------------------------------------------
step "Removing old images"
$DOCKER image prune -f >/dev/null

step "Done"
compose ps
