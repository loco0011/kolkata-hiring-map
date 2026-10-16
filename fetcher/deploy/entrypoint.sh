#!/bin/sh
# Brings the fetch-history database up to date, then runs the command
# (supercronic by default; or gunicorn for the admin, or a one-off command).
set -e
python manage.py migrate --noinput
exec "$@"
