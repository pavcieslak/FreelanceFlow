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

Create your account at `/register`, or seed one with
`AUTH_EMAIL`/`AUTH_PASSWORD` set and `npm run db:seed`.

## Optional integrations

| Feature | Env vars |
| --- | --- |
| Stripe payment links + auto-paid webhook | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Invoice email sending | `RESEND_API_KEY`, `EMAIL_FROM` |
| Clockify invoice import | `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID` |

Point the Stripe webhook at `POST /api/webhooks/stripe` with the
`checkout.session.completed` event.

## Stack

Next.js (App Router) · TypeScript · Prisma · PostgreSQL · NextAuth v5 ·
Tailwind CSS · react-pdf
