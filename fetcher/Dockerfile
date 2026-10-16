# syntax=docker/dockerfile:1
#
# Job fetcher. Runs fetch_jobs and check_links on a schedule with supercronic
# (cron for containers: runs in the foreground, logs to stdout).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.49
ARG SUPERCRONIC_SHA256_amd64=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1
ARG SUPERCRONIC_SHA256_arm64=02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5
ADD https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH} /usr/local/bin/supercronic
RUN set -e; \
    case "$TARGETARCH" in \
      amd64) sum="$SUPERCRONIC_SHA256_amd64" ;; \
      arm64) sum="$SUPERCRONIC_SHA256_arm64" ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    echo "$sum  /usr/local/bin/supercronic" | sha256sum -c -; \
    chmod +x /usr/local/bin/supercronic

RUN useradd --create-home --uid 1000 fetcher \
    && mkdir /data && chown fetcher:fetcher /data
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN DEBUG=true python manage.py collectstatic --noinput \
    && chmod +x deploy/entrypoint.sh

USER fetcher
# Fetch history lives in the `fetcher_data` volume
ENV DATABASE_URL=sqlite:////data/db.sqlite3
ENTRYPOINT ["deploy/entrypoint.sh"]
CMD ["supercronic", "-passthrough-logs", "deploy/crontab"]
