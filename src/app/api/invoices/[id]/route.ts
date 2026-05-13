import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      items: {
        include: { timeEntry: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Handle line items update: delete all and recreate
  if (body.items !== undefined) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      ...(body.number !== undefined && { number: body.number }),
      ...(body.clientId !== undefined && { clientId: body.clientId }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.issueDate !== undefined && { issueDate: new Date(body.issueDate) }),
      ...(body.dueDate !== undefined && { dueDate: new Date(body.dueDate) }),
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.invoice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
