import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientKey, __resetRateLimits } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows requests up to the limit and blocks the next one", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key independently", () => {
    rateLimit("a", 1, 60);
    expect(rateLimit("a", 1, 60).allowed).toBe(false);
    expect(rateLimit("b", 1, 60).allowed).toBe(true);
  });

  it("reports remaining budget", () => {
    expect(rateLimit("c", 3, 60).remaining).toBe(2);
    expect(rateLimit("c", 3, 60).remaining).toBe(1);
  });

  it("starts a fresh window once the old one expires", async () => {
    expect(rateLimit("d", 1, 1).allowed).toBe(true);
    expect(rateLimit("d", 1, 1).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect(rateLimit("d", 1, 1).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first address from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
    });
    expect(clientKey(req, "login")).toBe("login:203.0.113.5");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    const withReal = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientKey(withReal, "r")).toBe("r:198.51.100.7");
    expect(clientKey(new Request("https://example.com"), "r")).toBe("r:unknown");
  });
});
