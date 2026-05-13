import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      ...(body.startTime !== undefined && { startTime: new Date(body.startTime) }),
      ...(body.endTime !== undefined && { endTime: body.endTime ? new Date(body.endTime) : null }),
      ...(body.duration !== undefined && { duration: body.duration }),
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
