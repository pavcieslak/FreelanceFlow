import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { client: true, tasks: { where: { archived: false }, orderBy: { id: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const project = await prisma.project.update({
    where: { id: params.id },
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
