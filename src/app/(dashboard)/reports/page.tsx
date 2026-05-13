"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, FileText, ArrowUpDown } from "lucide-react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, format } from "date-fns";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatDuration, formatCurrency, formatDateShort, cn } from "@/lib/utils";
import { ReportData, Project, Client, TimeEntry } from "@/types";
import { useRouter } from "next/navigation";

type Preset = "today" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "custom";
type SortKey = "date" | "duration" | "amount";

function getPresetDates(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "this_week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": { const lw = subWeeks(now, 1); return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }) }; }
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function ReportsPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [billable, setBillable] = useState("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects?archived=false").then((r) => r.json()),
      fetch("/api/clients?archived=false").then((r) => r.json()),
    ]).then(([p, c]) => { setProjects(p); setClients(c); });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = preset === "custom"
        ? { start: new Date(customStart), end: new Date(customEnd + "T23:59:59") }
        : getPresetDates(preset);

      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        ...(billable !== "all" && { billable: billable === "billable" ? "true" : "false" }),
      });
      selectedProjects.forEach((id) => params.append("projectId", id));
      selectedClients.forEach((id) => params.append("clientId", id));

      const res = await fetch(`/api/reports?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd, selectedProjects, selectedClients, billable]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleProject(id: string) {
    setSelectedProjects((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleClient(id: string) {
    setSelectedClients((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sortedEntries = data ? [...data.entries].sort((a, b) => {
    let diff = 0;
    if (sortKey === "date") diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    else if (sortKey === "duration") diff = (a.duration ?? 0) - (b.duration ?? 0);
    else if (sortKey === "amount") {
      const aA = a.billable ? (a.duration ?? 0) / 3600 * (a.project?.hourlyRate ?? 0) : 0;
      const bA = b.billable ? (b.duration ?? 0) / 3600 * (b.project?.hourlyRate ?? 0) : 0;
      diff = aA - bA;
    }
    return sortAsc ? diff : -diff;
  }) : [];

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Date", "Description", "Project", "Client", "Tags", "Duration", "Amount", "Billable"],
      ...data.entries.map((e) => [
        formatDateShort(e.startTime),
        e.description ?? "",
        e.project?.name ?? "",
        e.project?.client?.name ?? "",
        e.tags?.map((t) => t.tag.name).join(", ") ?? "",
        formatDuration(e.duration ?? 0),
        e.billable ? String(Math.round((e.duration ?? 0) / 3600 * (e.project?.hourlyRate ?? 0) * 100) / 100) : "0",
        e.billable ? "Yes" : "No",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createInvoice() {
    if (!data || data.entries.length === 0) return;
    const clientId = data.entries.find((e) => e.project?.clientId)?.project?.clientId;
    if (!clientId) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, dueDate: dueDate.toISOString() }),
    });
    const inv = await res.json();
    if (inv.id) router.push(`/invoices/${inv.id}`);
  }

  const maxDayDuration = data ? Math.max(...data.dailyBreakdown.map((d) => d.duration), 1) : 1;

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "this_week", label: "This week" },
    { key: "last_week", label: "Last week" },
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_year", label: "This year" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <PageShell
      title="Reports"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={14} /> CSV</Button>
          <Button variant="secondary" size="sm" onClick={createInvoice}><FileText size={14} /> Invoice</Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Date presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ key, label }) => (
            <button key={key} onClick={() => setPreset(key)}
              className={cn("px-3 py-1.5 rounded text-sm transition-colors",
                preset === key ? "bg-accent text-white" : "bg-surface-elevated border border-border text-text-muted hover:text-text-primary")}>
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-3 items-center">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent text-sm" />
            <span className="text-text-muted">–</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {/* Project filter */}
          <div className="relative group">
            <button className={cn("px-3 py-2 rounded border text-sm transition-colors",
              selectedProjects.length > 0 ? "bg-accent/10 border-accent/30 text-accent" : "bg-surface-elevated border-border text-text-muted hover:text-text-primary")}>
              Projects {selectedProjects.length > 0 && `(${selectedProjects.length})`}
            </button>
            <div className="absolute top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-10 min-w-[180px] py-1 hidden group-focus-within:block group-hover:block">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} className="accent-accent" />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-text-primary">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Client filter */}
          <div className="relative group">
            <button className={cn("px-3 py-2 rounded border text-sm transition-colors",
              selectedClients.length > 0 ? "bg-accent/10 border-accent/30 text-accent" : "bg-surface-elevated border-border text-text-muted hover:text-text-primary")}>
              Clients {selectedClients.length > 0 && `(${selectedClients.length})`}
            </button>
            <div className="absolute top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-10 min-w-[180px] py-1 hidden group-focus-within:block group-hover:block">
              {clients.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedClients.includes(c.id)} onChange={() => toggleClient(c.id)} className="accent-accent" />
                  <span className="text-text-primary">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Billable filter */}
          <select value={billable} onChange={(e) => setBillable(e.target.value)}
            className="bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none">
            <option value="all">All entries</option>
            <option value="billable">Billable only</option>
            <option value="non_billable">Non-billable only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={6} />
      ) : data ? (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Total Tracked</p>
              <p className="text-2xl font-bold text-text-primary font-mono mt-1">{formatDuration(data.totalDuration)}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Billable Time</p>
              <p className="text-2xl font-bold text-success font-mono mt-1">{formatDuration(data.billableDuration)}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-text-muted text-sm">Billable Amount</p>
              <p className="text-2xl font-bold text-accent mt-1">{formatCurrency(data.totalAmount)}</p>
            </div>
          </div>

          {/* Daily bar chart */}
          {data.dailyBreakdown.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-muted mb-4">Daily Breakdown</h3>
              <div className="flex items-end gap-1 h-32">
                {data.dailyBreakdown.map((day) => {
                  const pct = (day.duration / maxDayDuration) * 100;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${format(new Date(day.date), "MMM d")}: ${formatDuration(day.duration)}`}>
                      <div className="w-full bg-accent/20 rounded-t relative" style={{ height: `${Math.max(pct, 2)}%` }}>
                        <div className="absolute inset-0 bg-accent/60 rounded-t group-hover:bg-accent transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-xs text-text-muted">
                {data.dailyBreakdown.length > 0 && (
                  <>
                    <span>{format(new Date(data.dailyBreakdown[0].date), "MMM d")}</span>
                    <span>{format(new Date(data.dailyBreakdown[data.dailyBreakdown.length - 1].date), "MMM d")}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Entry table */}
          {data.entries.length > 0 ? (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                        <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-text-primary">
                          Date <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Project</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Tags</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                        <button onClick={() => handleSort("duration")} className="flex items-center gap-1 hover:text-text-primary ml-auto">
                          Duration <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                        <button onClick={() => handleSort("amount")} className="flex items-center gap-1 hover:text-text-primary ml-auto">
                          Amount <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Bill.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => {
                      const amount = entry.billable ? Math.round((entry.duration ?? 0) / 3600 * (entry.project?.hourlyRate ?? 0) * 100) / 100 : 0;
                      return (
                        <tr key={entry.id} className="border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                          <td className="px-4 py-3 text-sm text-text-muted">{formatDateShort(entry.startTime)}</td>
                          <td className="px-4 py-3 text-sm text-text-primary max-w-[200px] truncate">{entry.description ?? <span className="italic text-text-muted">No description</span>}</td>
                          <td className="px-4 py-3">
                            {entry.project && (
                              <span className="flex items-center gap-1.5 text-sm text-text-muted">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.project.color }} />
                                {entry.project.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-muted">{entry.project?.client?.name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {entry.tags?.map(({ tag }) => (
                                <Badge key={tag.id} variant="default">{tag.name}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">{formatDuration(entry.duration ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-sm text-text-primary">{entry.billable ? formatCurrency(amount) : "—"}</td>
                          <td className="px-4 py-3 text-center">{entry.billable ? <span className="text-success text-xs">✓</span> : <span className="text-text-muted text-xs">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {sortedEntries.map((entry) => {
                  const amount = entry.billable ? Math.round((entry.duration ?? 0) / 3600 * (entry.project?.hourlyRate ?? 0) * 100) / 100 : 0;
                  return (
                    <div key={entry.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{entry.description ?? <span className="italic text-text-muted">No description</span>}</p>
                          {entry.project && (
                            <span className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.project.color }} />
                              {entry.project.name}
                            </span>
                          )}
                          <p className="text-xs text-text-muted mt-0.5">{formatDateShort(entry.startTime)}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-mono text-sm text-text-primary">{formatDuration(entry.duration ?? 0)}</p>
                          {entry.billable && <p className="text-xs text-success">{formatCurrency(amount)}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted">No entries for the selected period</div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
