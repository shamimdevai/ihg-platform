#!/usr/bin/env bash
set -e

: "${DATABASE_HOST:=db}"
: "${DATABASE_PORT:=5432}"

echo "Waiting for Postgres at ${DATABASE_HOST}:${DATABASE_PORT}..."

until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -q; do
  sleep 1
done

echo "Postgres is up."