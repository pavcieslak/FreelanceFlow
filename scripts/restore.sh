#!/bin/sh
# Restores a dump produced by backup.sh, replacing the current database.
#
#   docker compose run --rm backup /scripts/restore.sh /backups/projectflow-20260813T030000Z.sql.gz
#
# This is destructive: everything currently in the database is dropped. It asks
# for confirmation unless RESTORE_ASSUME_YES=1.
#
# Restore this into a scratch database now and then. A backup nobody has ever
# restored is a guess, not a backup.
set -eu

dump="${1:-}"
if [ -z "$dump" ]; then
  echo "usage: restore.sh <path-to-dump.sql.gz>" >&2
  exit 64
fi
if [ ! -f "$dump" ]; then
  echo "no such dump: $dump" >&2
  exit 66
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

host="${POSTGRES_HOST:-db}"

if [ "${RESTORE_ASSUME_YES:-0}" != "1" ]; then
  printf 'This DROPS everything in %s on %s and replaces it with %s.\nType yes to continue: ' \
    "$POSTGRES_DB" "$host" "$dump"
  read -r answer
  [ "$answer" = "yes" ] || { echo "aborted"; exit 1; }
fi

echo "[restore] resetting schema"
psql --host="$host" --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
     --set ON_ERROR_STOP=1 \
     -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo "[restore] loading $dump"
gunzip -c "$dump" \
  | psql --host="$host" --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
         --set ON_ERROR_STOP=1 --quiet

echo "[restore] done — restart the app so it reconnects"
