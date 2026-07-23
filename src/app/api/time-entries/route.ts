import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TimeEntryMode = "TIMER" | "HALF_DAY" | "FULL_DAY";

function getSlotDuration(mode: TimeEntryMode) {
  if (mode === "HALF_DAY") return 4 * 60 * 60;
  if (mode === "FULL_DAY") return 8 * 60 * 60;
  return null;
}

function normalizeDuration(
  mode: TimeEntryMode,
  startTime: Date,
  endTime: Date | null,
  rawDuration?: number | null
) {
  const slotDuration = getSlotDuration(mode);
  if (slotDuration !== null) return slotDuration;
  if (typeof rawDuration === "number") return rawDuration;
  if (endTime) {
    return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
  }
  return null;
}

function normalizeEndTime(mode: TimeEntryMode, startTime: Date, endTime: Date | null) {
  const slotDuration = getSlotDuration(mode);
  if (slotDuration === null) return endTime;
  return new Date(startTime.getTime() + slotDuration * 1000);
}

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
  const planned = sp.get("planned");

  const where: Record<string, unknown> = {};

  if (planned === "true") {
    where.isPlanned = true;
  } else if (planned !== "all") {
    where.isPlanned = false;
    where.endTime = { not: null };
  }

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
  const mode: TimeEntryMode = body.mode ?? "TIMER";
  const isPlanned = body.isPlanned ?? false;

  const startTime = body.startTime ? new Date(body.startTime) : new Date();
  const normalizedEndTime = normalizeEndTime(
    mode,
    startTime,
    body.endTime ? new Date(body.endTime) : null
  );
  const duration = normalizeDuration(mode, startTime, normalizedEndTime, body.duration);

  // Stop any active timer first
  if (!isPlanned && mode === "TIMER" && !normalizedEndTime) {
    const active = await prisma.timeEntry.findFirst({
      where: { endTime: null, isPlanned: false },
    });
    if (active) {
      const endTime = new Date();
      const activeDuration = Math.floor((endTime.getTime() - active.startTime.getTime()) / 1000);
      await prisma.timeEntry.update({
        where: { id: active.id },
        data: { endTime, duration: activeDuration },
      });
    }
  }

  if (mode !== "TIMER" && !body.endTime && !body.duration) {
    // Slot-based entries are meant to be saved entries, not running timers.
    if (!normalizedEndTime || duration === null) {
      return NextResponse.json({ error: "Invalid slot timing" }, { status: 400 });
    }
  }

  if (duration !== null && duration <= 0) {
    return NextResponse.json({ error: "Duration must be greater than zero" }, { status: 400 });
  }

  if (normalizedEndTime && normalizedEndTime < startTime) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  if (isPlanned) {
    const overlap = await prisma.timeEntry.findFirst({
      where: {
        isPlanned: true,
        startTime: { lt: normalizedEndTime ?? startTime },
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

  const tagIds: string[] = body.tagIds ?? [];

  const entry = await prisma.timeEntry.create({
    data: {
      description: body.description || null,
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      mode,
      isPlanned,
      startTime,
      endTime: normalizedEndTime,
      duration,
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
