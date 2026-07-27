import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  integrationStatus,
  isConfigured,
  allIntegrations,
  isGoogleEmailAllowed,
  googleAllowedEmails,
} from "@/lib/config";

const STRIPE_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const EMAIL_VARS = ["RESEND_API_KEY", "EMAIL_FROM"];
const GOOGLE_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ALLOWED_EMAILS"];
const ALL_VARS = [
  ...STRIPE_VARS,
  ...EMAIL_VARS,
  ...GOOGLE_VARS,
  "CLOCKIFY_API_KEY",
  "CLOCKIFY_WORKSPACE_ID",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ALL_VARS.map((v) => [v, process.env[v]]));
  for (const v of ALL_VARS) delete process.env[v];
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("integration configuration", () => {
  it("reports an integration as off when nothing is set", () => {
    const stripe = integrationStatus("stripe");
    expect(stripe.configured).toBe(false);
    expect(stripe.partial).toBe(false);
    expect(stripe.missing).toEqual(STRIPE_VARS);
  });

  it("reports configured only when every variable is set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    expect(isConfigured("stripe")).toBe(true);
    expect(integrationStatus("stripe").missing).toEqual([]);
  });

  // The regression this whole module exists to prevent: a Stripe key without a
  // webhook secret used to count as "enabled", so payment links were created
  // but nothing ever marked the invoice paid.
  it("treats a half-configured integration as off, not on", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const stripe = integrationStatus("stripe");
    expect(stripe.configured).toBe(false);
    expect(stripe.partial).toBe(true);
    expect(stripe.missing).toEqual(["STRIPE_WEBHOOK_SECRET"]);
  });

  it("ignores variables that are set but blank", () => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "   ";
    expect(isConfigured("email")).toBe(false);
    expect(integrationStatus("email").missing).toEqual(["EMAIL_FROM"]);
  });

  it("keeps integrations independent of each other", () => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "billing@example.com";

    expect(isConfigured("email")).toBe(true);
    expect(isConfigured("stripe")).toBe(false);
    expect(isConfigured("clockify")).toBe(false);
  });

  it("never leaks a variable's value, only its name", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_supersecret";

    const serialised = JSON.stringify(allIntegrations());
    expect(serialised).not.toContain("sk_test_supersecret");
    expect(serialised).toContain("STRIPE_WEBHOOK_SECRET");
  });
});

describe("google sign-in allowlist", () => {
  const enable = (allowed: string) => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ALLOWED_EMAILS = allowed;
  };

  it("counts as configured only with an allowlist present", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";

    // Credentials without an allowlist would mean anyone with a Google account
    // could sign in, so this must not read as configured.
    expect(isConfigured("google")).toBe(false);
    expect(integrationStatus("google").missing).toEqual(["GOOGLE_ALLOWED_EMAILS"]);
  });

  it("denies everyone when the integration is off", () => {
    expect(isGoogleEmailAllowed("me@example.com")).toBe(false);
  });

  it("allows only listed addresses", () => {
    enable("me@example.com, team@example.com");
    expect(isGoogleEmailAllowed("me@example.com")).toBe(true);
    expect(isGoogleEmailAllowed("team@example.com")).toBe(true);
    expect(isGoogleEmailAllowed("stranger@example.com")).toBe(false);
  });

  it("matches regardless of case or surrounding spaces", () => {
    enable("  Me@Example.COM  ");
    expect(isGoogleEmailAllowed("me@example.com")).toBe(true);
    expect(isGoogleEmailAllowed(" ME@EXAMPLE.COM ")).toBe(true);
  });

  it("never treats an empty or comma-only list as allow-all", () => {
    enable(" , , ");
    expect(googleAllowedEmails()).toEqual([]);
    expect(isGoogleEmailAllowed("anyone@example.com")).toBe(false);
    expect(isGoogleEmailAllowed("")).toBe(false);
  });

  it("does not match a partial or lookalike address", () => {
    enable("me@example.com");
    expect(isGoogleEmailAllowed("me@example.com.attacker.test")).toBe(false);
    expect(isGoogleEmailAllowed("notme@example.com")).toBe(false);
    expect(isGoogleEmailAllowed("me@example.co")).toBe(false);
  });
});
