import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entryIds: string[] = body.entryIds ?? [];

  if (!entryIds.length) {
    return NextResponse.json({ error: "No entries selected" }, { status: 400 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds }, isPlanned: false },
    include: { project: true },
  });

  const items = entries.map((entry) => {
    const hours = Math.round(((entry.duration ?? 0) / 3600) * 100) / 100;
    const unitPrice = entry.project?.hourlyRate ?? 0;
    const amount = Math.round(hours * unitPrice * 100) / 100;
    return {
      invoiceId: params.id,
      description: entry.description || `Work on ${entry.project?.name ?? "project"}`,
      quantity: hours,
      unitPrice,
      amount,
      timeEntryId: entry.id,
    };
  });

  await prisma.$transaction([
    prisma.invoiceItem.createMany({ data: items }),
    prisma.timeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { invoiced: true },
    }),
  ]);

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      items: { include: { timeEntry: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(invoice);
}
