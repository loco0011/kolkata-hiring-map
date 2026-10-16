#!/bin/sh
# Runs before php-fpm / the scheduler. Config is cached here, not at build
# time, because the settings come from the container's environment.
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

# Only the `app` service sets this, so migrations run once per deploy.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

exec "$@"
