/**
 * Environment validation.
 *
 * Fails fast and loudly on misconfiguration rather than letting the app boot
 * into a broken state (e.g. a missing auth secret, which silently breaks
 * sessions in production).
 */

type EnvIssue = { key: string; message: string };

const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET"] as const;

function collectIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) {
      issues.push({ key, message: `${key} is required` });
    }
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.trim().length < 32) {
    issues.push({
      key: "NEXTAUTH_SECRET",
      message: "NEXTAUTH_SECRET must be at least 32 characters (generate with: openssl rand -base64 32)",
    });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
    issues.push({
      key: "DATABASE_URL",
      message: "DATABASE_URL must be a PostgreSQL connection string (this app no longer supports SQLite)",
    });
  }

  // Stripe: a webhook secret without an API key means payments can never be
  // created, and an API key without a webhook secret means paid invoices are
  // never marked as paid. Both halves or neither.
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  const hasStripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (hasStripeKey !== hasStripeWebhook) {
    issues.push({
      key: "STRIPE_*",
      message:
        "Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither — " +
        "with only one of them, invoices can be paid but never marked as paid (or vice versa)",
    });
  }

  const hasResendKey = !!process.env.RESEND_API_KEY?.trim();
  const hasEmailFrom = !!process.env.EMAIL_FROM?.trim();
  if (hasResendKey !== hasEmailFrom) {
    issues.push({
      key: "RESEND_*",
      message: "Set both RESEND_API_KEY and EMAIL_FROM, or neither",
    });
  }

  return issues;
}

let validated = false;

/**
 * Validates env vars once per process. In production a fatal issue throws;
 * in development it warns so `next dev` stays usable while you fill in .env.
 */
export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const issues = collectIssues();
  if (!issues.length) return;

  const report = issues.map((i) => `  - ${i.message}`).join("\n");

  if (process.env.NODE_ENV === "production") {
    throw new Error(`Invalid environment configuration:\n${report}`);
  }
  console.warn(`[env] Configuration warnings:\n${report}`);
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim() && !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!process.env.EMAIL_FROM?.trim();
}
