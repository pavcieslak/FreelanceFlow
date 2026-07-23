import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const invoice = await prisma.invoice.findFirst({
    where: { id: id, userId },
  });
  if (!invoice) return notFound();

  const body = await req.json();
  const entryIds: string[] = body.entryIds ?? [];

  if (!entryIds.length) {
    return NextResponse.json({ error: "No entries selected" }, { status: 400 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds }, userId, isPlanned: false },
    include: { project: true },
  });

  const items = entries.map((entry) => {
    const hours = Math.round(((entry.duration ?? 0) / 3600) * 100) / 100;
    const unitPrice = entry.project?.hourlyRate ?? 0;
    const amount = Math.round(hours * unitPrice * 100) / 100;
    return {
      invoiceId: id,
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
      where: { id: { in: entries.map((e) => e.id) } },
      data: { invoiced: true },
    }),
  ]);

  const updated = await prisma.invoice.findFirst({
    where: { id: id, userId },
    include: {
      client: true,
      items: { include: { timeEntry: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
