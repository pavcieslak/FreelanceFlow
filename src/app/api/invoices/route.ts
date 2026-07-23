import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const sort = req.nextUrl.searchParams.get("sort");
  const orderBy =
    sort === "dueDate_desc"
      ? [{ dueDate: "desc" as const }, { createdAt: "desc" as const }]
      : [{ issueDate: "desc" as const }, { createdAt: "desc" as const }];

  const invoices = await prisma.invoice.findMany({
    where: status ? { status } : undefined,
    include: { client: true, items: true },
    orderBy,
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }
  if (!body.dueDate) {
    return NextResponse.json({ error: "Due date is required" }, { status: 400 });
  }

  const maxInvoice = await prisma.invoice.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = generateInvoiceNumber(maxInvoice?.number ?? null);

  const invoice = await prisma.invoice.create({
    data: {
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
