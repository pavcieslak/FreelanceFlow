import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.task.findFirst({
    where: { id: id, project: { userId } },
  });
  if (!existing) return notFound();

  const body = await req.json();
  const task = await prisma.task.update({
    where: { id: id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.archived !== undefined && { archived: body.archived }),
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.task.findFirst({
    where: { id: id, project: { userId } },
  });
  if (!existing) return notFound();

  await prisma.task.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
