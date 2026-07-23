"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, TrendingUp, DollarSign, Clock, ArrowRight } from "lucide-react";

interface RunwayData {
  currency: string;
  currentMonthValue: number;
  avgMonthlyIncome: number;
  monthlyExpenses: number;
  pendingRevenue: number;
  runway: number | null;
  monthlyHistory: Array<{ month: string; income: number }>;
}

function RunwayBar({ months }: { months: number }) {
  const capped = Math.min(months, 12);
  const pct = (capped / 12) * 100;
  const color =
    months < 1 ? "bg-danger" : months < 3 ? "bg-amber-500" : "bg-success";

  return (
    <div className="w-full bg-surface-elevated rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RunwayLabel({ months }: { months: number }) {
  if (months < 1)
    return (
      <span className="text-danger font-semibold">
        Less than 1 month — critical
      </span>
    );
  if (months < 3)
    return (
      <span className="text-amber-500 font-semibold">
        {months.toFixed(1)} months — watch closely
      </span>
    );
  return (
    <span className="text-success font-semibold">
      {months.toFixed(1)} months — looking good
    </span>
  );
}

function Sparkline({ data }: { data: Array<{ month: string; income: number }> }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.income), 1);

  return (
    <div className="flex items-end gap-1.5 h-16 w-full">
      {data.map((d) => {
        const heightPct = (d.income / max) * 100;
        const label = d.month.slice(5); // MM
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full flex items-end" style={{ height: "48px" }}>
              <div
                className="w-full bg-accent/30 group-hover:bg-accent/60 rounded-t transition-colors relative"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={formatCurrency(d.income)}
              />
            </div>
            <span className="text-[10px] text-text-muted">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-text-muted">
        <Icon size={15} className="shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export default function RunwayPage() {
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runway")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageShell title="Runway">
        <div className="space-y-4 w-full animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-lg" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!data) return null;

  const noExpenses = data.monthlyExpenses === 0;
  const fmt = (n: number) => formatCurrency(n, data.currency);

  return (
    <PageShell title="Runway">
      <div className="w-full space-y-6">

        {noExpenses && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-text-primary">
              Set your monthly expenses in{" "}
              <Link href="/settings" className="underline text-accent hover:text-accent/80">
                Settings
              </Link>{" "}
              to see your runway calculation.
            </p>
          </div>
        )}

        {/* Runway gauge */}
        {!noExpenses && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Financial Runway</h2>
              <span className="text-xs text-text-muted">based on pending revenue ÷ monthly expenses</span>
            </div>
            {data.runway !== null ? (
              <>
                <RunwayBar months={data.runway} />
                <RunwayLabel months={data.runway} />
                <p className="text-xs text-text-muted">
                  {fmt(data.pendingRevenue)} in pending invoices can cover{" "}
                  {data.runway.toFixed(1)} months of {fmt(data.monthlyExpenses)}/mo expenses.
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">No data available yet.</p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="This month (billable)"
            value={fmt(data.currentMonthValue)}
            sub="tracked, not yet invoiced value"
            icon={Clock}
          />
          <StatCard
            label="Avg monthly income"
            value={fmt(data.avgMonthlyIncome)}
            sub="based on last 3 months"
            icon={TrendingUp}
          />
          <StatCard
            label="Pending invoices"
            value={fmt(data.pendingRevenue)}
            sub="sent but not yet paid"
            icon={DollarSign}
          />
        </div>

        {/* Monthly history sparkline */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Billable income — last 6 months</h2>
          <Sparkline data={data.monthlyHistory} />
        </div>

        {/* CTA to set expenses if missing */}
        {noExpenses && (
          <Link
            href="/settings"
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-5 py-4 hover:border-accent transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">Set your monthly expenses</p>
              <p className="text-xs text-text-muted mt-0.5">Unlock your runway calculation in Settings → Defaults</p>
            </div>
            <ArrowRight size={16} className="text-text-muted group-hover:text-accent transition-colors" />
          </Link>
        )}
      </div>
    </PageShell>
  );
}
