import { createHmac, timingSafeEqual } from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function encodeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export async function createCheckoutSession(opts: {
  invoiceId: string;
  userId: string;
  invoiceNumber: string;
  currency: string;
  amount: number; // in major units
  clientEmail?: string | null;
  businessName?: string | null;
}): Promise<CheckoutSession> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");

  const unitAmount = Math.round(opts.amount * 100);
  if (unitAmount <= 0) throw new Error("Invoice total must be greater than zero");

  const productName = opts.businessName
    ? `Invoice ${opts.invoiceNumber} — ${opts.businessName}`
    : `Invoice ${opts.invoiceNumber}`;

  const params: Record<string, string> = {
    mode: "payment",
    "line_items[0][price_data][currency]": opts.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": productName,
    "line_items[0][price_data][unit_amount]": String(unitAmount),
    "line_items[0][quantity]": "1",
    success_url: `${appUrl()}/pay/success`,
    cancel_url: `${appUrl()}/pay/success?canceled=1`,
    client_reference_id: opts.invoiceId,
    "metadata[invoiceId]": opts.invoiceId,
    "metadata[userId]": opts.userId,
  };
  if (opts.clientEmail) params.customer_email = opts.clientEmail;

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(params),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Stripe request failed (${res.status})`);
  }
  return { id: data.id, url: data.url };
}

/**
 * Verifies a Stripe webhook signature (v1 scheme) without the SDK.
 * Header format: t=timestamp,v1=signature[,v1=...]
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").map((p) => p.split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}
