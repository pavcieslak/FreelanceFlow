import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.tag.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.update({
      where: { id: id },
      data: { name: body.name.trim() },
    });
    return NextResponse.json(tag);
  } catch {
    return NextResponse.json({ error: "Tag name already exists" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.tag.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  await prisma.tag.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
