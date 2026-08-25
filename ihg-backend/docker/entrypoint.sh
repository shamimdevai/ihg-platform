#!/usr/bin/env bash
set -e

/app/scripts/wait_for_db.sh

echo "Running Alembic migrations..."
alembic upgrade head

exec "$@"