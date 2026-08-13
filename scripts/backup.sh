#!/bin/sh
# Dumps the database to /backups and prunes old dumps.
#
# Runs inside the `backup` container (see docker-compose.yml), which is the
# postgres image, so pg_dump is present and matches the server version. It can
# also be run by hand from the host for an on-demand dump:
#
#   docker compose run --rm backup /scripts/backup.sh
#
# The dump is written to a temporary name and only renamed into place once
# pg_dump has exited successfully. A backup directory therefore never contains
# a half-written file that looks like a good backup — the failure mode that
# turns "we have backups" into "we had backups".
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

mkdir -p "$BACKUP_DIR"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/${POSTGRES_DB}-${stamp}.sql.gz"
raw="$target.partial"
tmp="$raw.gz"

cleanup() { rm -f "$raw" "$tmp"; }
trap cleanup EXIT

echo "[backup] dumping $POSTGRES_DB to $target"

# Dumped to a file and compressed separately rather than piped into gzip: in a
# pipeline the shell reports gzip's exit status, so a pg_dump that died halfway
# would be recorded as a successful backup. Here `set -e` sees pg_dump's own
# status, and `pipefail` isn't portable enough to rely on across /bin/sh.
pg_dump --host="${POSTGRES_HOST:-db}" \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --format=plain --no-owner --no-privileges \
        --file="$raw"

gzip -9 -c "$raw" > "$tmp"
rm -f "$raw"

# An empty or absurdly small file means the dump produced nothing useful even
# if every command reported success.
size=$(wc -c < "$tmp")
if [ "$size" -lt 1000 ]; then
  echo "[backup] FAILED: dump is only ${size} bytes, refusing to keep it" >&2
  exit 1
fi

mv "$tmp" "$target"
trap - EXIT
echo "[backup] wrote $target (${size} bytes)"

# Prune only files matching our own naming pattern, so nothing else that ends
# up in this directory is deleted.
find "$BACKUP_DIR" -maxdepth 1 -type f \
     -name "${POSTGRES_DB}-*.sql.gz" \
     -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed 's/^/[backup] pruned /'

# Copy the finished dump somewhere off this machine. The local dumps live on
# the same disk as the database, so they survive a bad migration or a dropped
# table but not a dead host — this hook is what makes them a real backup.
# Set BACKUP_POST_HOOK to a command; it receives the dump path as $1.
# e.g. BACKUP_POST_HOOK="rclone copy \$1 remote:projectflow-backups"
if [ -n "${BACKUP_POST_HOOK:-}" ]; then
  echo "[backup] running post-hook"
  sh -c "$BACKUP_POST_HOOK" _ "$target"
fi
