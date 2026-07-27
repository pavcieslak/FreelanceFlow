import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";

/**
 * Structural guards over the API surface.
 *
 * These do not exercise the routes; they check that every handler still opts
 * into the two rules the app's tenancy depends on — authenticate the caller,
 * and scope tenant data to them. A route added without either would otherwise
 * only be caught by noticing one account could read another's data.
 */

const API_DIR = path.join(__dirname, "..", "src", "app", "api");

/**
 * Routes that intentionally serve unauthenticated callers, each with the
 * reason it is safe. Anything not listed here must authenticate.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/[...nextauth]": "NextAuth's own sign-in/session handler",
  "auth/register": "Creates the account, so there is no session yet",
  "auth/forgot-password": "Reached by someone locked out; rate limited",
  "auth/reset-password": "Authenticated by the single-use reset token",
  health: "Liveness probe for monitoring; reports no user data",
  "webhooks/stripe": "Authenticated by Stripe's signature, not by a session",
};

/** Models with their own userId column — queries must constrain it. */
const TENANT_MODELS = ["client", "project", "tag", "timeEntry", "invoice", "settings"];

function routeFiles(): string[] {
  return readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => f.replace(/[\\/]route\.ts$/, "").split(path.sep).join("/"));
}

function sourceOf(route: string): string {
  return readFileSync(path.join(API_DIR, route, "route.ts"), "utf8");
}

describe("API route authentication", () => {
  const routes = routeFiles();

  it("finds the route files", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it("authenticates every route that is not explicitly public", () => {
    const unprotected = routes.filter(
      (route) => !(route in PUBLIC_ROUTES) && !sourceOf(route).includes("getUserId")
    );

    expect(
      unprotected,
      `These routes never call getUserId(). Either authenticate them, or add ` +
        `them to PUBLIC_ROUTES with the reason they are safe.`
    ).toEqual([]);
  });

  it("keeps the public allowlist free of routes that no longer exist", () => {
    const stale = Object.keys(PUBLIC_ROUTES).filter((r) => !routes.includes(r));
    expect(stale, "PUBLIC_ROUTES names routes that are gone").toEqual([]);
  });

  it("scopes every tenant-owned query to the signed-in user", () => {
    const offenders: string[] = [];

    for (const route of routes) {
      if (route in PUBLIC_ROUTES) continue;
      const src = sourceOf(route);

      const touched = TENANT_MODELS.filter((model) => src.includes(`prisma.${model}.`));
      if (touched.length && !src.includes("userId")) {
        offenders.push(`${route} (queries ${touched.join(", ")})`);
      }
    }

    expect(
      offenders,
      "These routes query tenant-owned models without mentioning userId"
    ).toEqual([]);
  });

  it("verifies the Stripe webhook signature, since it takes no session", () => {
    const src = sourceOf("webhooks/stripe");
    expect(src).toContain("verifyStripeSignature");
  });
});
