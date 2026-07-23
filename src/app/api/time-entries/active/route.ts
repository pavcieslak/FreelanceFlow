import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.timeEntry.findFirst({
    where: { endTime: null, isPlanned: false },
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(entry);
}
