import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { calculateAmount } from "@/lib/utils";
import { startOfMonth, startOfWeek, subMonths } from "date-fns";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const historyStart = startOfMonth(subMonths(now, 5));

  const [settings, windowEntries, unbilledEntries, openInvoices, activeTimer, recentEntries] =
    await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      // Completed entries for the last 6 months: powers month/week stats
      prisma.timeEntry.findMany({
        where: {
          userId,
          isPlanned: false,
          endTime: { not: null },
          startTime: { gte: historyStart },
        },
        select: {
          startTime: true,
          duration: true,
          billable: true,
          project: { select: { hourlyRate: true, currency: true } },
        },
      }),
      // All-time billable work not yet pulled into an invoice
      prisma.timeEntry.findMany({
        where: {
          userId,
          isPlanned: false,
          billable: true,
          invoiced: false,
          endTime: { not: null },
        },
        select: {
          duration: true,
          project: { select: { hourlyRate: true, currency: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { userId, status: "SENT" },
        include: { items: true },
      }),
      prisma.timeEntry.findFirst({
        where: { userId, endTime: null, isPlanned: false },
        include: { project: { include: { client: true } } },
      }),
      prisma.timeEntry.findMany({
        where: { userId, isPlanned: false, endTime: { not: null } },
        include: { project: { include: { client: true } } },
        orderBy: { startTime: "desc" },
        take: 6,
      }),
    ]);

  const earnedThisMonth: Record<string, number> = {};
  let trackedThisMonth = 0;
  let billableThisMonth = 0;
  let trackedThisWeek = 0;
  const monthlyEarned = new Map<string, number>();

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (const entry of windowEntries) {
    const dur = entry.duration ?? 0;
    const amount = entry.billable
      ? calculateAmount(dur, entry.project?.hourlyRate ?? 0)
      : 0;

    const key = monthKey(entry.startTime);
    monthlyEarned.set(key, (monthlyEarned.get(key) ?? 0) + amount);

    if (entry.startTime >= monthStart) {
      trackedThisMonth += dur;
      if (entry.billable) {
        billableThisMonth += dur;
        const currency = entry.project?.currency ?? "USD";
        earnedThisMonth[currency] = (earnedThisMonth[currency] ?? 0) + amount;
      }
    }
    if (entry.startTime >= weekStart) {
      trackedThisWeek += dur;
    }
  }

  const unbilled: Record<string, number> = {};
  for (const entry of unbilledEntries) {
    const amount = calculateAmount(entry.duration ?? 0, entry.project?.hourlyRate ?? 0);
    if (amount <= 0) continue;
    const currency = entry.project?.currency ?? "USD";
    unbilled[currency] = (unbilled[currency] ?? 0) + amount;
  }

  const outstanding: Record<string, number> = {};
  for (const inv of openInvoices) {
    const subtotal = inv.items.reduce((s, item) => s + item.amount, 0);
    const total = subtotal * (1 + inv.taxRate / 100);
    outstanding[inv.currency] = (outstanding[inv.currency] ?? 0) + total;
  }

  const monthlyHistory = [5, 4, 3, 2, 1, 0].map((n) => {
    const d = subMonths(now, n);
    return { month: monthKey(d), earned: monthlyEarned.get(monthKey(d)) ?? 0 };
  });

  const monthlyExpenses = settings?.monthlyExpenses ?? 0;
  const outstandingTotal = Object.values(outstanding).reduce((a, b) => a + b, 0);
  const runway = monthlyExpenses > 0 ? outstandingTotal / monthlyExpenses : null;

  return NextResponse.json({
    currency: settings?.defaultCurrency ?? "USD",
    trackedThisMonth,
    billableThisMonth,
    trackedThisWeek,
    earnedThisMonth,
    unbilled,
    outstanding,
    outstandingCount: openInvoices.length,
    monthlyHistory,
    monthlyExpenses,
    runway,
    activeTimer,
    recentEntries,
  });
}
