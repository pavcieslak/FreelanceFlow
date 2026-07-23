import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

type TimeEntryMode = "TIMER" | "HALF_DAY" | "FULL_DAY";

function getSlotDuration(mode: TimeEntryMode) {
  if (mode === "HALF_DAY") return 4 * 60 * 60;
  if (mode === "FULL_DAY") return 8 * 60 * 60;
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const entry = await prisma.timeEntry.findFirst({
    where: { id: id, userId },
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
  });
  if (!entry) return notFound();
  return NextResponse.json(entry);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  const existing = await prisma.timeEntry.findFirst({
    where: { id: id, userId },
  });
  if (!existing) return notFound();

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

  if (body.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }
  }

  if (isPlanned && endTime) {
    const overlap = await prisma.timeEntry.findFirst({
      where: {
        userId,
        id: { not: id },
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

  const tagIds: string[] | undefined = body.tagIds;
  if (tagIds !== undefined && tagIds.length) {
    const owned = await prisma.tag.count({ where: { id: { in: tagIds }, userId } });
    if (owned !== tagIds.length) {
      return NextResponse.json({ error: "Tag not found" }, { status: 400 });
    }
  }

  // Delete existing tags and recreate
  if (tagIds !== undefined) {
    await prisma.timeEntryTag.deleteMany({ where: { timeEntryId: id } });
  }

  const entry = await prisma.timeEntry.update({
    where: { id: id },
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
      ...(tagIds !== undefined && tagIds.length > 0 && {
        tags: { create: tagIds.map((tagId: string) => ({ tagId })) },
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.timeEntry.findFirst({
    where: { id: id, userId },
  });
  if (!existing) return notFound();

  await prisma.timeEntry.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
