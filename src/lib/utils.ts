import { format, isToday, isYesterday } from "date-fns";

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function calculateAmount(
  durationSeconds: number,
  hourlyRate: number
): number {
  return Math.round((durationSeconds / 3600) * hourlyRate * 100) / 100;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

export function formatDateShort(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy");
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), "HH:mm");
}

export function generateInvoiceNumber(maxNumber: string | null): string {
  if (!maxNumber) return "INV-001";
  const match = maxNumber.match(/INV-(\d+)$/);
  if (!match) return "INV-001";
  const next = parseInt(match[1], 10) + 1;
  return `INV-${String(next).padStart(3, "0")}`;
}

/**
 * Highest sequence number across existing invoice numbers.
 *
 * Sorting invoice numbers as strings in the database is wrong past 999
 * ("INV-999" sorts above "INV-1000"), and imported invoices may not follow the
 * INV-nnn shape at all, so the numeric part is compared explicitly here and
 * anything unrecognised is ignored rather than derailing the sequence.
 */
export function nextInvoiceNumberFrom(existingNumbers: string[]): string {
  let highest = 0;
  for (const value of existingNumbers) {
    const match = value.match(/^INV-(\d+)$/);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return `INV-${String(highest + 1).padStart(3, "0")}`;
}

export const CURRENCIES = ["USD", "GBP", "EUR", "PLN", "AUD", "CAD"] as const;

export const PROJECT_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#a78bfa",
] as const;

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
