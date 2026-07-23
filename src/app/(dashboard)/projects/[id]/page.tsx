"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ColorPicker from "@/components/ui/ColorPicker";
import { Project, Task, Client } from "@/types";
import { CURRENCIES, cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/Skeleton";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { tasks: Task[] }) | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "settings">("tasks");
  const [newTaskName, setNewTaskName] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Settings form state
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [billableByDefault, setBillableByDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProject() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        fetch(`/api/projects/${id}`).then((r) => r.json()),
        fetch("/api/clients?archived=false").then((r) => r.json()),
      ]);
      setProject(p);
      setClients(c);
      setName(p.name);
      setClientId(p.clientId ?? "");
      setColor(p.color);
      setHourlyRate(String(p.hourlyRate));
      setCurrency(p.currency);
      setBillableByDefault(p.billableByDefault);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProject(); }, [id]);

  async function addTask() {
    if (!newTaskName.trim()) return;
    setAddingTask(true);
    await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTaskName.trim() }),
    });
    setNewTaskName("");
    setAddingTask(false);
    loadProject();
  }

  async function toggleTaskArchive(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !task.archived }),
    });
    loadProject();
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    loadProject();
  }

  async function saveSettings() {
    setSaving(true);
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, clientId: clientId || null, color, hourlyRate: parseFloat(hourlyRate) || 0, currency, billableByDefault }),
    });
    setSaving(false);
    loadProject();
  }

  if (loading) return <div className="p-6"><SkeletonList /></div>;
  if (!project) return <div className="p-6 text-text-muted">Project not found</div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border flex items-center gap-3">
        <Link href="/projects" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
        <h1 className="text-xl font-semibold text-text-primary">{project.name}</h1>
      </div>

      <div className="flex border-b border-border px-4 md:px-6">
        {(["tasks", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors",
              tab === t ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary")}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 md:px-6 py-4">
        {tab === "tasks" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Add a task…"
                className="flex-1 bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm" />
              <Button onClick={addTask} loading={addingTask} size="sm">
                <Plus size={14} /> Add
              </Button>
            </div>

            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              {project.tasks.length === 0 ? (
                <div className="py-10 text-center text-text-muted text-sm">No tasks yet. Add one above.</div>
              ) : (
                project.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                    <span className={cn("flex-1 text-sm", task.archived && "line-through text-text-muted")}>{task.name}</span>
                    <button onClick={() => toggleTaskArchive(task)}
                      className="p-1.5 rounded text-text-muted hover:text-warning transition-colors">
                      {task.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                    <button onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="w-full max-w-none grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-muted">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-muted">Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none">
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-muted">Color</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-muted">Hourly Rate</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} min="0" step="0.01"
                  className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-muted">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <button type="button" onClick={() => setBillableByDefault((b) => !b)}
                className={cn("flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors",
                  billableByDefault ? "bg-success/10 border-success/30 text-success" : "bg-surface-elevated border-border text-text-muted")}>
                {billableByDefault ? "Billable by default" : "Non-billable by default"}
              </button>
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveSettings} loading={saving}>Save Settings</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
