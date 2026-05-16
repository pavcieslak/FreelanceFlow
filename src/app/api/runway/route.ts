import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const monthlyExpenses = settings?.monthlyExpenses ?? 0;
  const currency = settings?.defaultCurrency ?? "USD";

  const now = new Date();

  // Current month tracked billable value
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  const currentMonthEntries = await prisma.timeEntry.findMany({
    where: {
      billable: true,
      endTime: { not: null },
      startTime: { gte: currentMonthStart, lte: currentMonthEnd },
    },
    include: { project: true },
  });

  let currentMonthValue = 0;
  for (const entry of currentMonthEntries) {
    const rate = entry.project?.hourlyRate ?? settings?.defaultHourlyRate ?? 0;
    const hours = (entry.duration ?? 0) / 3600;
    currentMonthValue += hours * rate;
  }

  // Last 3 months average for projection
  const last3Months = await Promise.all(
    [1, 2, 3].map(async (n) => {
      const start = startOfMonth(subMonths(now, n));
      const end = endOfMonth(subMonths(now, n));
      const entries = await prisma.timeEntry.findMany({
        where: {
          billable: true,
          endTime: { not: null },
          startTime: { gte: start, lte: end },
        },
        include: { project: true },
      });
      let total = 0;
      for (const entry of entries) {
        const rate = entry.project?.hourlyRate ?? settings?.defaultHourlyRate ?? 0;
        const hours = (entry.duration ?? 0) / 3600;
        total += hours * rate;
      }
      return total;
    })
  );

  const avgMonthlyIncome = last3Months.reduce((a, b) => a + b, 0) / 3;

  // Outstanding invoices (SENT but not PAID)
  const pendingInvoices = await prisma.invoice.findMany({
    where: { status: "SENT" },
    include: { items: true },
  });
  const pendingRevenue = pendingInvoices.reduce((sum, inv) => {
    const subtotal = inv.items.reduce((s, item) => s + item.amount, 0);
    return sum + subtotal * (1 + inv.taxRate / 100);
  }, 0);

  // Runway calculation
  const runway = monthlyExpenses > 0
    ? pendingRevenue / monthlyExpenses
    : null;

  // Month-by-month history for sparkline (last 6 months)
  const monthlyHistory = await Promise.all(
    [5, 4, 3, 2, 1, 0].map(async (n) => {
      const d = subMonths(now, n);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const entries = await prisma.timeEntry.findMany({
        where: {
          billable: true,
          endTime: { not: null },
          startTime: { gte: start, lte: end },
        },
        include: { project: true },
      });
      let total = 0;
      for (const entry of entries) {
        const rate = entry.project?.hourlyRate ?? settings?.defaultHourlyRate ?? 0;
        const hours = (entry.duration ?? 0) / 3600;
        total += hours * rate;
      }
      return {
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        income: total,
      };
    })
  );

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
