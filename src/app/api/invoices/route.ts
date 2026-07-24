import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { nextInvoiceNumberFrom } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const status = req.nextUrl.searchParams.get("status");
  const sort = req.nextUrl.searchParams.get("sort");
  // Postgres ranks NULLs above every value, which would float invoices without
  // a deadline to the top of a "by due date" listing. Push them to the end.
  const orderBy =
    sort === "dueDate_desc"
      ? [
          { dueDate: { sort: "desc" as const, nulls: "last" as const } },
          { createdAt: "desc" as const },
        ]
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
  const client = await prisma.client.findFirst({
    where: { id: body.clientId, userId },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  // Two invoices created at the same moment would derive the same number, and
  // the unique constraint on (userId, number) rejects the loser. Recompute from
  // fresh state and retry instead of surfacing a 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.invoice.findMany({
      where: { userId },
      select: { number: true },
    });
    const number = nextInvoiceNumberFrom(existing.map((i) => i.number));

    try {
      const invoice = await prisma.invoice.create({
        data: {
          userId,
          number,
          clientId: body.clientId,
          status: "DRAFT",
          issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          subject: body.subject || null,
          notes: body.notes || null,
          currency: body.currency || "USD",
          taxRate: body.taxRate ?? 0,
        },
        include: { client: true, items: true },
      });
      return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
      const isDuplicate =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002";
      if (!isDuplicate) throw error;
      // Someone else took this number — the next loop reloads and retries.
    }
  }

  return NextResponse.json(
    { error: "Could not allocate an invoice number. Please try again." },
    { status: 409 }
  );
}
