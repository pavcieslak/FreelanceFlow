"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, FileText, TrendingUp, Timer, ArrowRight, type LucideIcon } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import Skeleton from "@/components/ui/Skeleton";
import { TimeEntry } from "@/types";
import { formatCurrency, formatDuration, formatDate, cn } from "@/lib/utils";

interface DashboardData {
  currency: string;
  trackedThisMonth: number;
  billableThisMonth: number;
  trackedThisWeek: number;
  earnedThisMonth: Record<string, number>;
  unbilled: Record<string, number>;
  outstanding: Record<string, number>;
  outstandingCount: number;
  monthlyHistory: Array<{ month: string; earned: number }>;
  monthlyExpenses: number;
  runway: number | null;
  activeTimer: TimeEntry | null;
  recentEntries: TimeEntry[];
}

function CurrencyAmounts({
  amounts,
  fallbackCurrency,
  emptyLabel,
}: {
  amounts: Record<string, number>;
  fallbackCurrency: string;
  emptyLabel: string;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => v > 0);
  if (!entries.length) {
    return (
      <p className="text-2xl font-semibold text-text-primary">
        {formatCurrency(0, fallbackCurrency)}
        <span className="sr-only">{emptyLabel}</span>
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {entries.map(([currency, amount]) => (
        <p key={currency} className="text-2xl font-semibold text-text-primary">
          {formatCurrency(amount, currency)}
        </p>
      ))}
    </div>
  );
}

function StatCard({
  label,
  icon: Icon,
  href,
  children,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/50 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {label}
        </span>
        <Icon size={16} className="text-text-muted group-hover:text-accent transition-colors" />
      </div>
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <PageShell title="Dashboard">
      {!data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {data.activeTimer && (
            <Link
              href="/tracker"
              className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg px-4 py-3 hover:bg-accent/15 transition-colors"
            >
              <Timer size={18} className="text-accent shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {data.activeTimer.description || "Timer running"}
                </p>
                {data.activeTimer.project && (
                  <p className="text-xs text-text-muted truncate">
                    {data.activeTimer.project.name}
                  </p>
                )}
              </div>
              <ArrowRight size={16} className="text-accent shrink-0" />
            </Link>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Earned this month" icon={TrendingUp} href="/reports">
              <CurrencyAmounts
                amounts={data.earnedThisMonth}
                fallbackCurrency={data.currency}
                emptyLabel="Nothing earned yet this month"
              />
              <p className="text-xs text-text-muted">
                {formatDuration(data.billableThisMonth)} billable ·{" "}
                {formatDuration(data.trackedThisMonth)} tracked
              </p>
            </StatCard>

            <StatCard label="Unbilled work" icon={Clock} href="/invoices">
              <CurrencyAmounts
                amounts={data.unbilled}
                fallbackCurrency={data.currency}
                emptyLabel="Everything is invoiced"
              />
              <p className="text-xs text-text-muted">
                Billable time not yet on an invoice
              </p>
            </StatCard>

            <StatCard label="Outstanding invoices" icon={FileText} href="/invoices">
              <CurrencyAmounts
                amounts={data.outstanding}
                fallbackCurrency={data.currency}
                emptyLabel="No outstanding invoices"
              />
              <p className="text-xs text-text-muted">
                {data.outstandingCount} invoice{data.outstandingCount === 1 ? "" : "s"} awaiting
                payment
              </p>
            </StatCard>

            <StatCard label="Runway" icon={TrendingUp} href="/runway">
              <p className="text-2xl font-semibold text-text-primary">
                {data.runway !== null ? `${data.runway.toFixed(1)} mo` : "—"}
              </p>
              <p className="text-xs text-text-muted">
                {data.monthlyExpenses > 0
                  ? `vs ${formatCurrency(data.monthlyExpenses, data.currency)}/mo expenses`
                  : "Set monthly expenses in Settings"}
              </p>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary">Recent activity</h2>
                <Link
                  href="/tracker"
                  className="text-xs text-text-muted hover:text-accent transition-colors"
                >
                  Open tracker
                </Link>
              </div>
              {data.recentEntries.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No time tracked yet. Start your first timer in the tracker.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentEntries.map((entry) => (
                    <li key={entry.id} className="py-2.5 flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.project?.color ?? "#6b7280" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {entry.description || entry.project?.name || "(no description)"}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {[entry.project?.name, formatDate(entry.startTime)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm tabular-nums shrink-0",
                          entry.billable ? "text-text-primary" : "text-text-muted"
                        )}
                      >
                        {formatDuration(entry.duration ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary">Last 6 months</h2>
                <span className="text-xs text-text-muted">
                  This week: {formatDuration(data.trackedThisWeek)}
                </span>
              </div>
              <ul className="space-y-2">
                {(() => {
                  const max = Math.max(...data.monthlyHistory.map((m) => m.earned), 1);
                  return data.monthlyHistory.map((m) => (
                    <li key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-text-muted w-16 shrink-0 tabular-nums">
                        {m.month}
                      </span>
                      <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.max(2, (m.earned / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-primary w-24 text-right shrink-0 tabular-nums">
                        {formatCurrency(m.earned, data.currency)}
                      </span>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
