import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const invoice = await prisma.invoice.findFirst({
    where: { id: id, userId },
    include: {
      client: true,
      items: {
        include: { timeEntry: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!invoice) return notFound();
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.invoice.findFirst({
    where: { id: id, userId },
  });
  if (!existing) return notFound();

  const body = await req.json();

  if (body.clientId !== undefined && body.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, userId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  // Handle line items update: delete all and recreate
  if (body.items !== undefined) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
  }

  const invoice = await prisma.invoice.update({
    where: { id: id },
    data: {
      ...(body.number !== undefined && { number: body.number }),
      ...(body.clientId !== undefined && { clientId: body.clientId }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.status === "PAID" && !existing.paidAt && { paidAt: new Date() }),
      ...(body.issueDate !== undefined && { issueDate: new Date(body.issueDate) }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }),
      ...(body.subject !== undefined && { subject: body.subject || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.taxRate !== undefined && { taxRate: body.taxRate }),
      ...(body.items !== undefined && {
        items: {
          create: body.items.map((item: { description: string; quantity: number; unitPrice: number; amount: number; timeEntryId?: string }) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            timeEntryId: item.timeEntryId || null,
          })),
        },
      }),
    },
    include: {
      client: true,
      items: { include: { timeEntry: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.invoice.findFirst({
    where: { id: id, userId },
  });
  if (!existing) return notFound();

  // Hours billed on this invoice go back to unbilled. Without this, deleting an
  // invoice strands them: the entries stay flagged `invoiced`, so no later
  // invoice can pick them up and the work can never be billed again.
  const items = await prisma.invoiceItem.findMany({
    where: { invoiceId: id, timeEntryId: { not: null } },
    select: { timeEntryId: true },
  });
  const entryIds = items.map((i) => i.timeEntryId!);

  // One transaction, so a failed delete cannot leave the entries un-marked
  // against an invoice that still exists.
  await prisma.$transaction([
    ...(entryIds.length
      ? [
          prisma.timeEntry.updateMany({
            where: { id: { in: entryIds }, userId },
            data: { invoiced: false },
          }),
        ]
      : []),
    prisma.invoice.delete({ where: { id: id } }),
  ]);

  return NextResponse.json({ success: true });
}
