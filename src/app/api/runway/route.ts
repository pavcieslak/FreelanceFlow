import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { invoiceTotals, roundMoney } from "@/lib/utils";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const settings = await prisma.settings.findUnique({ where: { userId } });
  const monthlyExpenses = settings?.monthlyExpenses ?? 0;
  const defaultRate = settings?.defaultHourlyRate ?? 0;
  const currency = settings?.defaultCurrency ?? "USD";

  const now = new Date();
  const windowStart = startOfMonth(subMonths(now, 5));
  const windowEnd = endOfMonth(now);

  // One query for the whole 6-month window, bucketed by month in JS
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      billable: true,
      isPlanned: false,
      endTime: { not: null },
      startTime: { gte: windowStart, lte: windowEnd },
    },
    select: {
      startTime: true,
      duration: true,
      project: { select: { hourlyRate: true } },
    },
  });

  const monthlyIncome = new Map<string, number>();
  for (const entry of entries) {
    const d = entry.startTime;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rate = entry.project?.hourlyRate ?? defaultRate;
    const value = ((entry.duration ?? 0) / 3600) * rate;
    monthlyIncome.set(key, (monthlyIncome.get(key) ?? 0) + value);
  }

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const currentMonthValue = monthlyIncome.get(monthKey(now)) ?? 0;

  const last3Months = [1, 2, 3].map(
    (n) => monthlyIncome.get(monthKey(subMonths(now, n))) ?? 0
  );
  const avgMonthlyIncome = last3Months.reduce((a, b) => a + b, 0) / 3;

  // Outstanding invoices (SENT but not PAID)
  const pendingInvoices = await prisma.invoice.findMany({
    where: { userId, status: "SENT" },
    include: { items: true },
  });
  const pendingRevenue = roundMoney(
    pendingInvoices.reduce(
      (sum, inv) => sum + invoiceTotals(inv.items, inv.taxRate).total,
      0
    )
  );

  // Runway calculation
  const runway = monthlyExpenses > 0 ? pendingRevenue / monthlyExpenses : null;

  // Month-by-month history for sparkline (last 6 months)
  const monthlyHistory = [5, 4, 3, 2, 1, 0].map((n) => {
    const d = subMonths(now, n);
    return {
      month: monthKey(d),
      income: monthlyIncome.get(monthKey(d)) ?? 0,
    };
  });

  return NextResponse.json({
    currency,
    currentMonthValue,
    avgMonthlyIncome,
    monthlyExpenses,
    pendingRevenue,
    runway,
    monthlyHistory,
  });
}
