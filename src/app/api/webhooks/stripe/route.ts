import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature } from "@/lib/stripe";
import { logger, serverError } from "@/lib/logger";

interface StripeCheckoutSession {
  id?: string;
  amount_total?: number;
  currency?: string;
  metadata?: { invoiceId?: string; userId?: string };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature, secret)) {
    logger.warn("stripe webhook rejected: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  const eventId = event.id;
  const eventType = event.type;
  const session = event.data?.object as StripeCheckoutSession | undefined;

  try {
    // Recording the event and applying its effect happen in one transaction:
    // if the invoice update fails, the event record rolls back too, so Stripe's
    // retry is able to process it again rather than being skipped as a duplicate.
    const outcome = await prisma.$transaction(async (tx) => {
      // Stripe retries deliveries and can send the same event more than once.
      // The primary key on event id is the idempotency gate — whichever
      // delivery inserts first is the one that does the work.
      await tx.processedWebhookEvent.create({
        data: { id: eventId, type: eventType },
      });

      if (eventType !== "checkout.session.completed") {
        return { handled: false as const };
      }

      const invoiceId = session?.metadata?.invoiceId;
      const userId = session?.metadata?.userId;
      if (!invoiceId || !userId) {
        logger.warn("stripe session missing invoice metadata", { eventId });
        return { handled: false as const };
      }

      const paidAmount = (session?.amount_total ?? 0) / 100;

      // Conditional update: only transitions an invoice that is not already
      // paid, so a replayed event can never overwrite a settled invoice.
      const result = await tx.invoice.updateMany({
        where: { id: invoiceId, userId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidAmount,
          balanceAmount: 0,
        },
      });

      return { handled: true as const, invoiceId, updated: result.count };
    });

    if (outcome.handled) {
      logger.info("stripe payment applied", {
        eventId,
        invoiceId: outcome.invoiceId,
        updated: outcome.updated,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      logger.info("stripe webhook already processed", { eventId });
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Returning 500 makes Stripe retry, which is what we want on a transient
    // database failure.
    return serverError("stripe webhook processing failed", error);
  }
}
