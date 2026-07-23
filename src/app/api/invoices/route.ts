import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { generateInvoiceNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const status = req.nextUrl.searchParams.get("status");
  const sort = req.nextUrl.searchParams.get("sort");
  const orderBy =
    sort === "dueDate_desc"
      ? [{ dueDate: "desc" as const }, { createdAt: "desc" as const }]
      : [{ issueDate: "desc" as const }, { createdAt: "desc" as const }];

  const invoices = await prisma.invoice.findMany({
    where: { userId, ...(status && { status }) },
    include: { client: true, items: true },
    orderBy,
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (!body.clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }
  if (!body.dueDate) {
    return NextResponse.json({ error: "Due date is required" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: body.clientId, userId },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const maxInvoice = await prisma.invoice.findFirst({
    where: { userId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = generateInvoiceNumber(maxInvoice?.number ?? null);

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      number,
      clientId: body.clientId,
      status: "DRAFT",
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      dueDate: new Date(body.dueDate),
      subject: body.subject || null,
      notes: body.notes || null,
      currency: body.currency || "USD",
      taxRate: body.taxRate ?? 0,
    },
    include: { client: true, items: true },
  });
  return NextResponse.json(invoice, { status: 201 });
}
