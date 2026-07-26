import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";
import { stripeEnabled, createCheckoutSession } from "@/lib/stripe";
import { notConfiguredMessage } from "@/lib/config";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  if (!stripeEnabled()) {
    return NextResponse.json({ error: notConfiguredMessage("stripe") }, { status: 503 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: id, userId },
    include: { client: true, items: true },
  });
  if (!invoice) return notFound();

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const subtotal = invoice.items.reduce((s, item) => s + item.amount, 0);
  const total = Math.round(subtotal * (1 + invoice.taxRate / 100) * 100) / 100;
  if (total <= 0) {
    return NextResponse.json(
      { error: "Add line items before creating a payment link" },
      { status: 400 }
    );
  }

  const settings = await prisma.settings.findUnique({ where: { userId } });

  try {
    const session = await createCheckoutSession({
      invoiceId: invoice.id,
      userId,
      invoiceNumber: invoice.number,
      currency: invoice.currency,
      amount: total,
      clientEmail: invoice.client.email,
      businessName: settings?.businessName ?? settings?.fullName ?? null,
    });

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripeSessionId: session.id, paymentUrl: session.url },
      include: { client: true, items: true },
    });

    return NextResponse.json({ paymentUrl: session.url, invoice: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment link" },
      { status: 502 }
    );
  }
}
