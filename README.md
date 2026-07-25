# ProjectFlow

Time tracking, project profitability and invoicing for freelancers. Track your time,
plan bookings, watch per-project profitability and financial runway, then turn tracked
hours into invoices your clients can pay online.

## Features

- **Multi-user SaaS** — register an account; every client, project, time entry and
  invoice is private to its owner (PostgreSQL + Prisma).
- **Time tracker** — live timer, half-day/full-day slots, planned bookings calendar,
  tags and per-project tasks.
- **Invoicing** — build invoices from tracked time, PDF export, email sending
  (Resend) and Stripe payment links with automatic "paid" status via webhook.
- **Financial cockpit** — dashboard with earned-this-month, unbilled work,
  outstanding invoices and runway; dedicated profitability and runway views.
- **PWA** — installable on mobile, offline app shell.
- **Clockify import** — pull existing invoices from a Clockify workspace.

## Getting started

```bash
# 1. Start PostgreSQL (or point DATABASE_URL at your own)
docker compose up -d db

# 2. Configure environment
cp .env.example .env.local   # fill in NEXTAUTH_SECRET at minimum

# 3. Install and migrate
npm install
npx prisma migrate deploy

# 4. Run
npm run dev
```

Create your account at `/register` — signing up needs no email provider.

### Getting in without email

Creating an account and signing in work with no mail provider configured;
`RESEND_API_KEY`/`EMAIL_FROM` are only needed to *send* things (password reset
links and invoices). If you're locked out and can't receive a reset link,
create or reset an account straight against the database:

```bash
npm run user:set -- you@example.com "your-password"
```

It creates the account if it doesn't exist, resets the password if it does,
and is safe to re-run.

### When something fails with "Something went wrong"

Open `/api/health`. It reports whether the database is reachable and whether
the schema matches this build — the usual cause is pulling new code without
running `npx prisma migrate deploy`, and the response names the missing
migrations and the command to fix it.

## Migrating data from the old single-tenant SQLite version

Versions before the multi-tenant/Postgres switch stored everything in a local
SQLite file (`prisma/dev.db` by default, or `prisma/prisma/dev.db` on very old
checkouts). That file is untouched by the Postgres migration — it just isn't
wired up anymore. To pull clients, projects, time entries and invoices from it
into your new account:

```bash
# 1. Register your account at /register first (or via db:seed) so it exists
#    in the new database — the import attaches everything to it.

# 2. Point at the old file and your account, then run the importer.
#    Run this from the SAME environment where prisma/dev.db actually lives
#    (e.g. inside the Codespace that used to run the old version).
MIGRATE_USER_EMAIL=you@example.com \
SQLITE_PATH=./prisma/dev.db \
npm run db:migrate-from-sqlite
```

It prints a summary of how many rows were imported per table. Every row keeps
its original id, so it's safe to re-run — already-imported rows are skipped,
nothing gets duplicated.

## Optional integrations

| Feature | Env vars |
| --- | --- |
| Stripe payment links + auto-paid webhook | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Invoice email sending | `RESEND_API_KEY`, `EMAIL_FROM` |
| Clockify invoice import | `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID` |

Point the Stripe webhook at `POST /api/webhooks/stripe` with the
`checkout.session.completed` event.

## Deploying to your own server

The app ships as a Docker image with a standalone Next.js server. On an Ubuntu
host with Docker installed:

```bash
git clone <your-repo> projectflow && cd projectflow

# docker-compose.override.yml only exists for local dev — it publishes Postgres
# to the host. Remove it on the server so the database stays private.
rm -f docker-compose.override.yml

cat > .env <<'EOF'
POSTGRES_PASSWORD=<a long random password>
NEXTAUTH_SECRET=<openssl rand -base64 32>
APP_URL=https://projectflow.yourdomain.com
APP_PORT=3000
EOF

docker compose up -d --build
```

Migrations run automatically on container start, and the container reports
health at `/api/health`. To update:

```bash
git pull && docker compose up -d --build
```

### Before exposing it to the internet

- **Terminate TLS in front of the app.** Put Caddy or nginx in front of port
  3000 — the app sets HSTS, which only makes sense over HTTPS. Caddy gets you a
  certificate automatically with a two-line config.
- **Make sure your proxy overwrites `X-Forwarded-For`** rather than appending to
  it, otherwise clients can spoof it and bypass the login/signup rate limits.
- **Back up the database.** The Docker volume is the only copy of your data:
  `docker compose exec -T db pg_dump -U projectflow projectflow | gzip > backup-$(date +%F).sql.gz`,
  ideally on a cron job with copies kept off the machine.
- **Restrict signups if the instance is only for you.** `/register` is open to
  anyone who can reach it; put it behind your proxy or a firewall rule if the
  host is public.

## Development

```bash
npm test          # unit tests (Vitest)
npm run typecheck # tsc --noEmit
npm run build     # production build
```

CI runs typecheck, tests and a build against a real PostgreSQL service on every
push (`.github/workflows/ci.yml`).

## Stack

Next.js (App Router) · TypeScript · Prisma · PostgreSQL · NextAuth v5 ·
Tailwind CSS · react-pdf · Vitest
