"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { TimeEntry, Project, Tag } from "@/types";
import { cn } from "@/lib/utils";
import { DollarSign } from "lucide-react";

interface Props {
  entry: TimeEntry | null;
  projects: Project[];
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}

export default function EditEntryModal({ entry, projects, tags, onClose, onSaved }: Props) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [billable, setBillable] = useState(true);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setDescription(entry.description ?? "");
    setProjectId(entry.projectId ?? "");
    setTagIds(entry.tags?.map((t) => t.tag.id) ?? []);
    setBillable(entry.billable);
    const start = new Date(entry.startTime);
    setDate(start.toISOString().slice(0, 10));
    setStartTime(start.toTimeString().slice(0, 5));
    if (entry.endTime) {
      setEndTime(new Date(entry.endTime).toTimeString().slice(0, 5));
    }
  }, [entry]);

  async function handleSave() {
    if (!entry) return;
    setLoading(true);
    try {
      const startDt = new Date(`${date}T${startTime}`);
      const endDt = endTime ? new Date(`${date}T${endTime}`) : null;
      const duration = endDt ? Math.floor((endDt.getTime() - startDt.getTime()) / 1000) : null;
      await fetch(`/api/time-entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          projectId: projectId || null,
          tagIds,
          billable,
          startTime: startDt.toISOString(),
          endTime: endDt?.toISOString() ?? null,
          duration,
        }),
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function toggleTag(id: string) {
    setTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  return (
    <Modal open={!!entry} onClose={onClose} title="Edit Time Entry">
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on?"
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.client ? ` · ${p.client.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                  tagIds.includes(tag.id)
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-surface-elevated border-border text-text-muted hover:text-text-primary"
                )}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBillable((b) => !b)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors",
              billable
                ? "bg-success/10 border-success/30 text-success"
                : "bg-surface-elevated border-border text-text-muted"
            )}
          >
            <DollarSign size={14} />
            {billable ? "Billable" : "Non-billable"}
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
