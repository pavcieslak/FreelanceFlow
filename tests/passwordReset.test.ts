import { describe, it, expect } from "vitest";
import {
  createResetToken,
  hashResetToken,
  tokenHashEquals,
  resetTokenExpiry,
  validatePassword,
  passwordProblemMessage,
  RESET_TOKEN_TTL_MINUTES,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/passwordReset";

describe("createResetToken", () => {
  it("returns a token together with its hash", () => {
    const { token, tokenHash } = createResetToken();
    expect(token.length).toBeGreaterThan(20);
    expect(tokenHash).toBe(hashResetToken(token));
  });

  it("never repeats a token", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createResetToken().token));
    expect(tokens.size).toBe(200);
  });

  it("produces URL-safe tokens so they survive being put in a link", () => {
    for (let i = 0; i < 50; i++) {
      const { token } = createResetToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(token)).toBe(token);
    }
  });

  it("hashes to something that does not reveal the token", () => {
    const { token, tokenHash } = createResetToken();
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toContain(token);
  });
});

describe("tokenHashEquals", () => {
  it("matches identical hashes and rejects different ones", () => {
    const a = hashResetToken("one");
    expect(tokenHashEquals(a, hashResetToken("one"))).toBe(true);
    expect(tokenHashEquals(a, hashResetToken("two"))).toBe(false);
  });

  it("rejects rather than throwing on length mismatch", () => {
    expect(tokenHashEquals(hashResetToken("one"), "short")).toBe(false);
  });
});

describe("resetTokenExpiry", () => {
  it("expires the configured number of minutes after issue", () => {
    const from = new Date("2026-01-01T12:00:00.000Z");
    const expiry = resetTokenExpiry(from);
    expect(expiry.getTime() - from.getTime()).toBe(RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  });

  it("is in the future when issued now", () => {
    expect(resetTokenExpiry().getTime()).toBeGreaterThan(Date.now());
  });
});

describe("validatePassword", () => {
  it("accepts a password at or above the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword("a longer passphrase")).toBeNull();
  });

  it("rejects passwords below the minimum", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("too_short");
    expect(validatePassword("")).toBe("too_short");
  });

  it("rejects passwords beyond the maximum", () => {
    expect(validatePassword("a".repeat(MAX_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword("a".repeat(MAX_PASSWORD_LENGTH + 1))).toBe("too_long");
  });

  it("describes each problem for the user", () => {
    expect(passwordProblemMessage("too_short")).toContain(String(MIN_PASSWORD_LENGTH));
    expect(passwordProblemMessage("too_long")).toContain(String(MAX_PASSWORD_LENGTH));
  });
});
