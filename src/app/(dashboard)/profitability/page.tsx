"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import { formatCurrency, formatDuration, cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

type ProjectRow = {
  id: string;
  name: string;
  color: string;
  currency: string;
  client: { name: string } | null;
  targetRate: number;
  totalDuration: number;
  billableDuration: number;
  billedAmount: number;
  invoicedAmount: number;
  uninvoicedAmount: number;
  effectiveRate: number | null;
  efficiency: number | null;
};

type ProfitabilityData = {
  period: string;
  projects: ProjectRow[];
  summary: {
    currency: string;
    totalDuration: number;
    billableDuration: number;
    totalEarned: number;
    effectiveRate: number | null;
  };
};

const PERIODS = [
  { key: "month", label: "This month" },
  { key: "3months", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;

function EfficiencyBar({ efficiency }: { efficiency: number | null }) {
  if (efficiency === null) {
    return <span className="text-xs text-text-muted">No rate set</span>;
  }
  const capped = Math.min(efficiency, 120);
  const color =
    efficiency >= 90
      ? "bg-success"
      : efficiency >= 70
      ? "bg-amber-500"
      : "bg-danger";
  const label =
    efficiency >= 90 ? "On target" : efficiency >= 70 ? "Watch" : "Under";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 bg-surface-elevated rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${(capped / 120) * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-medium w-16 text-right tabular-nums",
          efficiency >= 90
            ? "text-success"
            : efficiency >= 70
            ? "text-amber-500"
            : "text-danger"
        )}
      >
        {efficiency.toFixed(0)}% · {label}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
        {label}
      </p>
      <p className="text-xl font-bold text-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function ProfitabilityPage() {
  const [period, setPeriod] = useState<string>("month");
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profitability?period=${period}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const noRates = data?.projects.every((p) => p.targetRate === 0) ?? false;

  return (
    <PageShell title="Profitability">
      <div className="space-y-5">
        {/* Period filter */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors",
                period === key
                  ? "bg-accent text-white"
                  : "bg-surface-elevated border border-border text-text-muted hover:text-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rate warning */}
        {!loading && noRates && data && data.projects.length > 0 && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
            <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-text-primary">
              No hourly rates are set on your projects. Set rates on individual{" "}
              <Link href="/projects" className="underline text-accent">
                project pages
              </Link>{" "}
              to unlock efficiency tracking.
            </p>
          </div>
        )}

        {/* Summary cards */}
        {!loading && data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Tracked"
              value={formatDuration(data.summary.totalDuration)}
              sub="total hours"
            />
            <StatCard
              label="Billable"
              value={formatDuration(data.summary.billableDuration)}
              sub={
                data.summary.totalDuration > 0
                  ? `${Math.round((data.summary.billableDuration / data.summary.totalDuration) * 100)}% of tracked`
                  : undefined
              }
            />
            <StatCard
              label="Total earned"
              value={
                data.summary.totalEarned > 0
                  ? formatCurrency(data.summary.totalEarned, data.summary.currency)
                  : "—"
              }
              sub="billable value"
            />
            <StatCard
              label="Effective rate"
              value={
                data.summary.effectiveRate !== null
                  ? `${formatCurrency(data.summary.effectiveRate, data.summary.currency)}/hr`
                  : "—"
              }
              sub="across all projects"
            />
          </div>
        )}

        {/* Projects table */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 bg-surface border border-border rounded-lg"
              />
            ))}
          </div>
        ) : !data || data.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-muted font-medium">No tracked time yet</p>
            <p className="text-text-muted text-sm mt-1">
              Start tracking time against projects to see profitability data.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-surface border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Project
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Tracked
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Billable
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Target rate
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Effective rate
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Efficiency
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      Uninvoiced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex items-center gap-2 hover:text-accent transition-colors"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <div>
                            <p className="font-medium text-text-primary text-sm">
                              {project.name}
                            </p>
                            {project.client && (
                              <p className="text-xs text-text-muted">
                                {project.client.name}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                        {formatDuration(project.totalDuration)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-muted">
                        {formatDuration(project.billableDuration)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-text-muted">
                        {project.targetRate > 0
                          ? formatCurrency(project.targetRate, project.currency) + "/hr"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                        {project.effectiveRate !== null
                          ? formatCurrency(project.effectiveRate, project.currency) + "/hr"
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <EfficiencyBar efficiency={project.efficiency} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {project.uninvoicedAmount > 0 ? (
                          <span className="text-amber-500 font-mono font-medium">
                            {formatCurrency(project.uninvoicedAmount, project.currency)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block bg-surface border border-border rounded-lg p-4 hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="font-medium text-text-primary text-sm">
                      {project.name}
                    </span>
                    {project.client && (
                      <span className="text-xs text-text-muted">
                        · {project.client.name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-text-muted">Tracked</p>
                      <p className="font-mono text-text-primary font-medium">
                        {formatDuration(project.totalDuration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Billable</p>
                      <p className="font-mono text-text-primary font-medium">
                        {formatDuration(project.billableDuration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Target rate</p>
                      <p className="text-text-primary font-medium">
                        {project.targetRate > 0
                          ? formatCurrency(project.targetRate, project.currency) + "/hr"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Effective rate</p>
                      <p className="font-mono text-text-primary font-medium">
                        {project.effectiveRate !== null
                          ? formatCurrency(project.effectiveRate, project.currency) + "/hr"
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <EfficiencyBar efficiency={project.efficiency} />

                  {project.uninvoicedAmount > 0 && (
                    <p className="text-xs text-amber-500 font-medium mt-2">
                      {formatCurrency(project.uninvoicedAmount, project.currency)} uninvoiced
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
