import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object as
      | {
          id?: string;
          amount_total?: number;
          metadata?: { invoiceId?: string; userId?: string };
        }
      | undefined;

    const invoiceId = session?.metadata?.invoiceId;
    const userId = session?.metadata?.userId;

    if (invoiceId && userId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, userId },
      });
      if (invoice && invoice.status !== "PAID") {
        const paidAmount = (session?.amount_total ?? 0) / 100;
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paidAmount: paidAmount || invoice.paidAmount,
            balanceAmount: 0,
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
