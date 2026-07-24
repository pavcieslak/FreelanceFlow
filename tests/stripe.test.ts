import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyStripeSignature } from "@/lib/stripe";

const SECRET = "whsec_test_secret";

function sign(payload: string, timestamp: number, secret = SECRET): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

  it("accepts a correctly signed recent payload", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(payload, sign(payload, now), SECRET)).toBe(true);
  });

  it("rejects a payload signed with a different secret", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = sign(payload, now, "whsec_wrong_secret");
    expect(verifyStripeSignature(payload, header, SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = sign(payload, now);
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    expect(verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects replays outside the tolerance window", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyStripeSignature(payload, sign(payload, old), SECRET)).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    expect(verifyStripeSignature(payload, null, SECRET)).toBe(false);
    expect(verifyStripeSignature(payload, "garbage", SECRET)).toBe(false);
    expect(verifyStripeSignature(payload, "t=123", SECRET)).toBe(false);
  });

  it("accepts when the header carries several v1 signatures and one matches", () => {
    const now = Math.floor(Date.now() / 1000);
    const valid = sign(payload, now).split("v1=")[1];
    const header = `t=${now},v1=deadbeef,v1=${valid}`;
    expect(verifyStripeSignature(payload, header, SECRET)).toBe(true);
  });
});
