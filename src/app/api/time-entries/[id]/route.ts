import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TimeEntryMode = "TIMER" | "HALF_DAY" | "FULL_DAY";

function getSlotDuration(mode: TimeEntryMode) {
  if (mode === "HALF_DAY") return 4 * 60 * 60;
  if (mode === "FULL_DAY") return 8 * 60 * 60;
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.timeEntry.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const existing = await prisma.timeEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mode: TimeEntryMode = body.mode ?? existing.mode;
  const isPlanned: boolean = body.isPlanned ?? existing.isPlanned;
  const startTime: Date = body.startTime ? new Date(body.startTime) : existing.startTime;

  let endTime: Date | null;
  if (body.endTime !== undefined) {
    endTime = body.endTime ? new Date(body.endTime) : null;
  } else {
    endTime = existing.endTime;
  }

  const slotDuration = getSlotDuration(mode);
  if (slotDuration !== null) {
    endTime = new Date(startTime.getTime() + slotDuration * 1000);
  }

  const duration =
    slotDuration !== null
      ? slotDuration
      : body.duration !== undefined
        ? body.duration
        : endTime
          ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
          : null;

  if (endTime && endTime < startTime) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  if (duration !== null && duration <= 0) {
    return NextResponse.json({ error: "Duration must be greater than zero" }, { status: 400 });
  }

  if (isPlanned && endTime) {
    const overlap = await prisma.timeEntry.findFirst({
      where: {
        id: { not: params.id },
        isPlanned: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap) {
      return NextResponse.json(
        { error: "This booking overlaps an existing planned slot" },
        { status: 409 }
      );
    }
  }

  // Delete existing tags and recreate
  if (body.tagIds !== undefined) {
    await prisma.timeEntryTag.deleteMany({ where: { timeEntryId: params.id } });
  }

  const entry = await prisma.timeEntry.update({
    where: { id: params.id },
    data: {
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.taskId !== undefined && { taskId: body.taskId || null }),
      startTime,
      endTime,
      duration,
      mode,
      isPlanned,
      ...(body.billable !== undefined && { billable: body.billable }),
      ...(body.invoiced !== undefined && { invoiced: body.invoiced }),
      ...(body.tagIds !== undefined && body.tagIds.length > 0 && {
        tags: { create: body.tagIds.map((tagId: string) => ({ tagId })) },
      }),
    },
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.timeEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
