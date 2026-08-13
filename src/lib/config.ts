/**
 * The single source of truth for optional integrations.
 *
 * Every integration is all-or-nothing: it counts as configured only when all
 * of its environment variables are set. That rule exists because partial
 * configuration used to be the worst state to be in — a Stripe secret key
 * without a webhook secret produced working payment links whose invoices were
 * never marked paid, because two different modules disagreed about what
 * "configured" meant.
 *
 * Nothing outside this module should read an integration's environment
 * variables to decide whether a feature is available. Ask `isConfigured` or
 * render `allIntegrations()`.
 */

export type IntegrationId = "email" | "stripe" | "clockify" | "google";

interface IntegrationSpec {
  id: IntegrationId;
  label: string;
  /** All of these must be set for the integration to count as configured. */
  vars: string[];
  /** What turning it on gets you. */
  enables: string;
  /** How to work without it, shown wherever the feature is unavailable. */
  fallback: string;
}

const SPECS: readonly IntegrationSpec[] = [
  {
    id: "email",
    label: "Email delivery (Resend)",
    vars: ["RESEND_API_KEY", "EMAIL_FROM"],
    enables: "Emailing invoices to clients and sending password-reset links.",
    fallback: "Export the invoice as a PDF and send it yourself.",
  },
  {
    id: "stripe",
    label: "Stripe payments",
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    enables: "Payment links on invoices, and marking them paid automatically.",
    fallback: "Mark invoices as paid by hand once the money arrives.",
  },
  {
    id: "clockify",
    label: "Clockify import",
    vars: ["CLOCKIFY_API_KEY", "CLOCKIFY_WORKSPACE_ID"],
    enables: "Importing existing invoices from a Clockify workspace.",
    fallback: "Create invoices directly in the app.",
  },
  {
    id: "google",
    label: "Sign in with Google",
    // GOOGLE_ALLOWED_EMAILS is required, not optional, on purpose. Enabling the
    // provider without an allowlist would let anyone with a Google account
    // create an account on this instance — an open signup page for whoever can
    // reach the URL. Making it a required variable means that state cannot be
    // reached by configuring things halfway.
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ALLOWED_EMAILS"],
    enables: "Registering and signing in with a Google account, for the listed addresses.",
    fallback: "Sign in with an email address and password.",
  },
];

export interface IntegrationStatus extends IntegrationSpec {
  configured: boolean;
  /** Which of `vars` are still unset — empty when configured. */
  missing: string[];
  /**
   * True when some but not all variables are set. Worth surfacing separately:
   * it usually means someone stopped halfway through setup.
   */
  partial: boolean;
}

function isSet(name: string): boolean {
  return !!process.env[name]?.trim();
}

function describe(spec: IntegrationSpec): IntegrationStatus {
  const missing = spec.vars.filter((v) => !isSet(v));
  return {
    ...spec,
    missing,
    configured: missing.length === 0,
    partial: missing.length > 0 && missing.length < spec.vars.length,
  };
}

export function allIntegrations(): IntegrationStatus[] {
  return SPECS.map(describe);
}

export function integrationStatus(id: IntegrationId): IntegrationStatus {
  const spec = SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown integration: ${id}`);
  return describe(spec);
}

export function isConfigured(id: IntegrationId): boolean {
  return integrationStatus(id).configured;
}

/**
 * Addresses permitted to sign in with Google, lowercased.
 *
 * The list is the whole authorisation model for Google sign-in: an address on
 * it may sign in and, if it has no account yet, gets one created; an address
 * off it is refused outright. Returns empty when the integration is off, and
 * an empty list denies everyone — never "allow all", which is the failure mode
 * that would matter here.
 */
export function googleAllowedEmails(): string[] {
  return (process.env.GOOGLE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isGoogleEmailAllowed(email: string): boolean {
  if (!isConfigured("google")) return false;
  return googleAllowedEmails().includes(email.trim().toLowerCase());
}

/**
 * Message for an API route to return when a feature's integration is missing.
 * Kept here so the wording matches what the Settings page shows.
 */
export function notConfiguredMessage(id: IntegrationId): string {
  const { label, missing, fallback } = integrationStatus(id);
  return `${label} is not configured. Set ${missing.join(" and ")} in your environment to enable it. ${fallback}`;
}
