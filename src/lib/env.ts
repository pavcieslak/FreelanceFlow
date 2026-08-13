/**
 * Environment validation.
 *
 * Fails fast and loudly on misconfiguration rather than letting the app boot
 * into a broken state (e.g. a missing auth secret, which silently breaks
 * sessions in production).
 */

import { existsSync, readFileSync } from "node:fs";
import { allIntegrations } from "@/lib/config";

type EnvIssue = { key: string; message: string };

const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET"] as const;

/**
 * Whether a `.env.local` on disk assigns `key`.
 *
 * Next.js reads `.env.local` in preference to `.env`, while the Prisma CLI
 * reads only `.env`. A `DATABASE_URL` left behind in `.env.local` therefore
 * points the app at one database and every migration at another, and the
 * symptom — migrations that succeed against data the app cannot see — gives no
 * hint about which file is responsible. When a value looks wrong it is worth
 * saying where it most likely came from.
 *
 * Only the presence of the assignment is reported. The value is never read,
 * so nothing here can put a password into a log line.
 */
function assignedInEnvLocal(key: string): boolean {
  try {
    if (!existsSync(".env.local")) return false;
    const pattern = new RegExp(`^\\s*(export\\s+)?${key}\\s*=`, "m");
    return pattern.test(readFileSync(".env.local", "utf8"));
  } catch {
    // Diagnostics must never be the reason startup fails.
    return false;
  }
}

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
      message:
        "DATABASE_URL must be a PostgreSQL connection string (this app no longer supports SQLite)" +
        (assignedInEnvLocal("DATABASE_URL")
          ? ". The value in use is most likely the one in .env.local, which Next.js " +
            "prefers over .env — fix or delete that line, not the one in .env"
          : ""),
    });
  }

  // Half-configured integrations are the worst state to be in: the feature
  // looks available but cannot complete. The integration registry knows which
  // variables belong together, so this stays in step with it automatically
  // rather than repeating the pairings here.
  for (const { label, missing, partial } of allIntegrations()) {
    if (partial) {
      issues.push({
        key: label,
        message: `${label} is half-configured — set ${missing.join(" and ")}, or unset the others to turn the feature off`,
      });
    }
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
