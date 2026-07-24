import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";
import { emailEnabled, sendEmail, renderInvoiceEmail } from "@/lib/email";
import { stripeEnabled, createCheckoutSession } from "@/lib/stripe";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  if (!emailEnabled()) {
    return NextResponse.json(
      {
        error:
          "Email sending is not configured. Set RESEND_API_KEY and EMAIL_FROM to enable it.",
      },
      { status: 503 }
    );
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: id, userId },
    include: { client: true, items: true },
  });
  if (!invoice) return notFound();

  if (!invoice.client.email) {
    return NextResponse.json(
      { error: "This client has no email address. Add one first." },
      { status: 400 }
    );
  }
  if (!invoice.items.length) {
    return NextResponse.json(
      { error: "Add line items before sending the invoice" },
      { status: 400 }
    );
  }

  const settings = await prisma.settings.findUnique({ where: { userId } });
  const businessName =
    settings?.businessName ?? settings?.fullName ?? "Your freelancer";

  const subtotal = invoice.items.reduce((s, item) => s + item.amount, 0);
  const total = Math.round(subtotal * (1 + invoice.taxRate / 100) * 100) / 100;

  // Attach a Stripe payment link when possible, but never block sending on it
  let paymentUrl = invoice.paymentUrl;
  if (!paymentUrl && stripeEnabled() && total > 0 && invoice.status !== "PAID") {
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
      paymentUrl = session.url;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { stripeSessionId: session.id, paymentUrl: session.url },
      });
    } catch {
      paymentUrl = null;
    }
  }

  try {
    await sendEmail({
      to: invoice.client.email,
      subject: `Invoice ${invoice.number} from ${businessName}`,
      replyTo: settings?.email ?? null,
      html: renderInvoiceEmail({
        invoiceNumber: invoice.number,
        businessName,
        clientName: invoice.client.name,
        currency: invoice.currency,
        subtotal,
        taxRate: invoice.taxRate,
        total,
        dueDate: invoice.dueDate ? format(invoice.dueDate, "MMMM d, yyyy") : null,
        notes: invoice.notes,
        paymentUrl,
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 502 }
    );
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      sentAt: new Date(),
      ...(invoice.status === "DRAFT" && { status: "SENT" }),
    },
    include: {
      client: true,
      items: { include: { timeEntry: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
