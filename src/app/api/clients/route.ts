import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const archived = req.nextUrl.searchParams.get("archived") === "true";
  const clients = await prisma.client.findMany({
    where: { userId, archived },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      userId,
      name: body.name.trim(),
      email: body.email || null,
      address: body.address || null,
      currency: body.currency || "USD",
    },
  });
  return NextResponse.json(client, { status: 201 });
}
