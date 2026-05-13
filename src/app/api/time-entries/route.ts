import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get("page") ?? "1");
  const limit = parseInt(sp.get("limit") ?? "50");
  const projectId = sp.get("projectId");
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const billable = sp.get("billable");
  const invoiced = sp.get("invoiced");

  const where: Record<string, unknown> = {
    endTime: { not: null },
  };
  if (projectId) where.projectId = projectId;
  if (startDate || endDate) {
    where.startTime = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }
  if (billable === "true") where.billable = true;
  if (billable === "false") where.billable = false;
  if (invoiced === "true") where.invoiced = true;
  if (invoiced === "false") where.invoiced = false;

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      include: {
        project: { include: { client: true } },
        task: true,
        tags: { include: { tag: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.timeEntry.count({ where }),
  ]);

  return NextResponse.json({ entries, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Stop any active timer first
  const active = await prisma.timeEntry.findFirst({
    where: { endTime: null },
  });
  if (active) {
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - active.startTime.getTime()) / 1000);
    await prisma.timeEntry.update({
      where: { id: active.id },
      data: { endTime, duration },
    });
  }

  const tagIds: string[] = body.tagIds ?? [];

  const entry = await prisma.timeEntry.create({
    data: {
      description: body.description || null,
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      startTime: body.startTime ? new Date(body.startTime) : new Date(),
      endTime: body.endTime ? new Date(body.endTime) : null,
      duration: body.duration ?? null,
      billable: body.billable ?? true,
      tags: tagIds.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
