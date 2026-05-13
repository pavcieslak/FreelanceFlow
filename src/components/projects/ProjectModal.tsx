"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ColorPicker from "@/components/ui/ColorPicker";
import { CURRENCIES, cn } from "@/lib/utils";
import { Project, Client } from "@/types";

interface Props {
  project: Project | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ProjectModal({ project, clients, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [billableByDefault, setBillableByDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setClientId(project.clientId ?? "");
      setColor(project.color);
      setHourlyRate(String(project.hourlyRate));
      setCurrency(project.currency);
      setBillableByDefault(project.billableByDefault);
    } else {
      setName(""); setClientId(""); setColor("#3b82f6");
      setHourlyRate("0"); setCurrency("USD"); setBillableByDefault(true);
    }
    setError("");
  }, [project]);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const method = project ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          clientId: clientId || null,
          color,
          hourlyRate: parseFloat(hourlyRate) || 0,
          currency,
          billableByDefault,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={project ? "Edit Project" : "New Project"}>
      <div className="p-5 space-y-4">
        {error && <p className="text-danger text-sm bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</p>}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm"
            placeholder="Project name" />
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

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setBillableByDefault((b) => !b)}
            className={cn("flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors",
              billableByDefault ? "bg-success/10 border-success/30 text-success" : "bg-surface-elevated border-border text-text-muted")}>
            {billableByDefault ? "Billable by default" : "Non-billable by default"}
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={loading} className="flex-1">Save</Button>
        </div>
      </div>
    </Modal>
  );
}
