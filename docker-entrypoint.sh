#!/bin/sh
set -e

# Applies any pending migrations before the server accepts traffic. Safe to run
# on every boot — `migrate deploy` only applies migrations that haven't run yet
# and never rewrites existing data.
echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Starting ProjectFlow..."
exec "$@"
