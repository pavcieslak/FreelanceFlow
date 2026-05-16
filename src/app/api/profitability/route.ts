import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAmount } from "@/lib/utils";
import { startOfMonth, subMonths, startOfYear } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const period = sp.get("period") ?? "all";

  let startDate: Date | undefined;
  const now = new Date();
  if (period === "month") startDate = startOfMonth(now);
  else if (period === "3months") startDate = startOfMonth(subMonths(now, 2));
  else if (period === "year") startDate = startOfYear(now);

  const projects = await prisma.project.findMany({
    where: { archived: false },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  const entries = await prisma.timeEntry.findMany({
    where: {
      endTime: { not: null },
      ...(startDate && { startTime: { gte: startDate } }),
    },
    select: {
      projectId: true,
      duration: true,
      billable: true,
      invoiced: true,
      project: { select: { hourlyRate: true } },
    },
  });

  type Agg = {
    totalDuration: number;
    billableDuration: number;
    billedAmount: number;
    invoicedAmount: number;
  };

  const byProject = new Map<string, Agg>();

  for (const entry of entries) {
    if (!entry.projectId) continue;
    if (!byProject.has(entry.projectId)) {
      byProject.set(entry.projectId, {
        totalDuration: 0,
        billableDuration: 0,
        billedAmount: 0,
        invoicedAmount: 0,
      });
    }
    const agg = byProject.get(entry.projectId)!;
    const dur = entry.duration ?? 0;
    agg.totalDuration += dur;
    if (entry.billable) {
      agg.billableDuration += dur;
      const amount = calculateAmount(dur, entry.project?.hourlyRate ?? 0);
      agg.billedAmount += amount;
      if (entry.invoiced) agg.invoicedAmount += amount;
    }
  }

  // Summary across all projects
  let summaryTracked = 0;
  let summaryBillable = 0;
  let summaryEarned = 0;

  const rows = projects
    .map((project) => {
      const agg = byProject.get(project.id) ?? {
        totalDuration: 0,
        billableDuration: 0,
        billedAmount: 0,
        invoicedAmount: 0,
      };

      const targetRate = project.hourlyRate;
      const billableHours = agg.billableDuration / 3600;
      const effectiveRate =
        billableHours > 0 ? agg.billedAmount / billableHours : null;
      const efficiency =
        targetRate > 0 && effectiveRate !== null
          ? (effectiveRate / targetRate) * 100
          : null;

      summaryTracked += agg.totalDuration;
      summaryBillable += agg.billableDuration;
      summaryEarned += agg.billedAmount;

      return {
        id: project.id,
        name: project.name,
        color: project.color,
        currency: project.currency,
        client: project.client ? { name: project.client.name } : null,
        targetRate,
        totalDuration: agg.totalDuration,
        billableDuration: agg.billableDuration,
        billedAmount: agg.billedAmount,
        invoicedAmount: agg.invoicedAmount,
        uninvoicedAmount: agg.billedAmount - agg.invoicedAmount,
        effectiveRate,
        efficiency,
      };
    })
    .filter((p) => p.totalDuration > 0)
    .sort((a, b) => {
      // Sort: projects with rate set and under target first (most urgent), then by earned desc
      if (a.efficiency !== null && b.efficiency !== null)
        return a.efficiency - b.efficiency;
      if (a.efficiency !== null) return -1;
      if (b.efficiency !== null) return 1;
      return b.billedAmount - a.billedAmount;
    });

  const summaryEffectiveRate =
    summaryBillable > 0 ? summaryEarned / (summaryBillable / 3600) : null;

  return NextResponse.json({
    period,
    projects: rows,
    summary: {
      totalDuration: summaryTracked,
      billableDuration: summaryBillable,
      totalEarned: summaryEarned,
      effectiveRate: summaryEffectiveRate,
    },
  });
}
