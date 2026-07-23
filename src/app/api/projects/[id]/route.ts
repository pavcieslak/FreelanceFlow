import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const project = await prisma.project.findFirst({
    where: { id: id, userId },
    include: { client: true, tasks: { where: { archived: false }, orderBy: { id: "asc" } } },
  });
  if (!project) return notFound();
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.project.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  const body = await req.json();

  if (body.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, userId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  const project = await prisma.project.update({
    where: { id: id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.clientId !== undefined && { clientId: body.clientId || null }),
      ...(body.hourlyRate !== undefined && { hourlyRate: body.hourlyRate }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.billableByDefault !== undefined && { billableByDefault: body.billableByDefault }),
      ...(body.archived !== undefined && { archived: body.archived }),
    },
    include: { client: true },
  });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.project.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  await prisma.project.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
