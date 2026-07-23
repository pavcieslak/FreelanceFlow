import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAmount } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const projectIds = sp.getAll("projectId");
  const clientIds = sp.getAll("clientId");
  const billable = sp.get("billable");

  const where: Record<string, unknown> = { endTime: { not: null }, isPlanned: false };
  if (startDate || endDate) {
    where.startTime = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }
  if (projectIds.length) where.projectId = { in: projectIds };
  if (billable === "true") where.billable = true;
  if (billable === "false") where.billable = false;

  let entries = await prisma.timeEntry.findMany({
    where,
    include: {
      project: { include: { client: true } },
      task: true,
      tags: { include: { tag: true } },
    },
    orderBy: { startTime: "desc" },
  });

  // Filter by clientId after join (since it's on project)
  if (clientIds.length) {
    entries = entries.filter(
      (e) => e.project?.clientId && clientIds.includes(e.project.clientId)
    );
  }

  let totalDuration = 0;
  let billableDuration = 0;
  let totalAmount = 0;
  const currencyTotals: Record<string, number> = {};
  const dailyMap: Record<string, { duration: number; amount: number }> = {};

  for (const entry of entries) {
    const dur = entry.duration ?? 0;
    totalDuration += dur;
    if (entry.billable) {
      billableDuration += dur;
      const amount = calculateAmount(dur, entry.project?.hourlyRate ?? 0);
      totalAmount += amount;
      const currency = entry.project?.currency ?? "USD";
      currencyTotals[currency] = (currencyTotals[currency] ?? 0) + amount;
    }
    const day = format(new Date(entry.startTime), "yyyy-MM-dd");
    if (!dailyMap[day]) dailyMap[day] = { duration: 0, amount: 0 };
    dailyMap[day].duration += dur;
    if (entry.billable) {
      dailyMap[day].amount += calculateAmount(dur, entry.project?.hourlyRate ?? 0);
    }
  }

  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    entries,
    totalDuration,
    billableDuration,
    totalAmount,
    currencyTotals,
    dailyBreakdown,
  });
}
