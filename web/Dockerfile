# syntax=docker/dockerfile:1
#
# Laravel site. Two images come out of this file (see ../docker-compose.yml):
#   app   — PHP-FPM running the site; also used for the scheduler
#   caddy — the web server: serves public/ and passes PHP to `app`

# ---- base: PHP with the extensions Laravel + MySQL need ----
FROM php:8.3-fpm-alpine AS base
RUN docker-php-ext-install pdo_mysql opcache \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-khm.ini"
WORKDIR /app

# ---- vendor: Composer packages (no dev packages) ----
FROM base AS vendor
RUN apk add --no-cache unzip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-interaction

# ---- assets: Vite build of the React frontend ----
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- app: the PHP-FPM image that runs the site ----
FROM base AS app
COPY --from=vendor /app /app
COPY --from=assets /app/public/build /app/public/build
COPY docker/entrypoint.sh /usr/local/bin/khm-entrypoint
RUN chmod +x /usr/local/bin/khm-entrypoint \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
ENTRYPOINT ["khm-entrypoint"]
CMD ["php-fpm"]

# ---- caddy: web server with the static files baked in ----
FROM caddy:2.10-alpine AS caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=app /app/public /app/public
