import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const project = await prisma.project.findFirst({ where: { id: id, userId } });
  if (!project) return notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: id },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const project = await prisma.project.findFirst({ where: { id: id, userId } });
  if (!project) return notFound();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: { name: body.name.trim(), projectId: id },
  });
  return NextResponse.json(task, { status: 201 });
}
