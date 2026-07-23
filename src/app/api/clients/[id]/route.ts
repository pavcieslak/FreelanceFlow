import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const client = await prisma.client.findFirst({ where: { id: id, userId } });
  if (!client) return notFound();
  return NextResponse.json(client);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (body.name !== undefined && !body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.client.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  const client = await prisma.client.update({
    where: { id: id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.archived !== undefined && { archived: body.archived }),
    },
  });
  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.client.findFirst({ where: { id: id, userId } });
  if (!existing) return notFound();

  await prisma.client.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
