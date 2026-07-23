import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const archived = req.nextUrl.searchParams.get("archived") === "true";
  const clientId = req.nextUrl.searchParams.get("clientId");

  const projects = await prisma.project.findMany({
    where: {
      userId,
      archived,
      ...(clientId && { clientId }),
    },
    include: {
      client: true,
      _count: { select: { timeEntries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (body.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, userId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  const project = await prisma.project.create({
    data: {
      userId,
      name: body.name.trim(),
      color: body.color || "#3b82f6",
      clientId: body.clientId || null,
      hourlyRate: body.hourlyRate ?? 0,
      currency: body.currency || "USD",
      billableByDefault: body.billableByDefault ?? true,
    },
    include: { client: true },
  });
  return NextResponse.json(project, { status: 201 });
}
