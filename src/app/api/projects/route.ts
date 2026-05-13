import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const archived = req.nextUrl.searchParams.get("archived") === "true";
  const clientId = req.nextUrl.searchParams.get("clientId");

  const projects = await prisma.project.findMany({
    where: {
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
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
