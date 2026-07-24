import { randomBytes, createHash, timingSafeEqual } from "crypto";

/** How long a reset link stays usable. Short, because it lands in an inbox. */
export const RESET_TOKEN_TTL_MINUTES = 60;

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only considers the first 72 bytes; reject longer input rather than
// silently ignoring the tail.
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Generates the token that goes in the emailed link, plus the hash to store.
 * The raw token never touches the database.
 */
export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two token hashes, so an attacker can't narrow
 * down a valid token by measuring how long a rejection takes.
 */
export function tokenHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

export type PasswordProblem = "too_short" | "too_long" | null;

export function validatePassword(password: string): PasswordProblem {
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password.length > MAX_PASSWORD_LENGTH) return "too_long";
  return null;
}

export function passwordProblemMessage(problem: Exclude<PasswordProblem, null>): string {
  return problem === "too_short"
    ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    : `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
}

export function renderResetEmail(opts: { resetUrl: string; expiresInMinutes: number }): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
    <h2 style="margin-bottom:8px;">Reset your password</h2>
    <p style="color:#374151;">
      We received a request to reset your ProjectFlow password. This link works
      once and expires in ${opts.expiresInMinutes} minutes.
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.resetUrl}"
         style="background:#3b82f6;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        Choose a new password
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      If the button doesn't work, paste this into your browser:<br />
      <span style="word-break:break-all;">${opts.resetUrl}</span>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      Didn't request this? You can ignore this email — your password stays as it is.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Sent by ProjectFlow</p>
  </div>`;
}
