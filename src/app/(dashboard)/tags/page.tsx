"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import { Tag } from "@/types";
import { SkeletonList } from "@/components/ui/Skeleton";

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch("/api/tags").then((r) => r.json());
      setTags(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addTag() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    load();
  }

  async function deleteTag(id: string) {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  return (
    <PageShell title="Tags">
      <div className="w-full space-y-4">
        {/* Add new tag */}
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="New tag name…"
            className="flex-1 bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm" />
          <Button onClick={addTag} loading={adding} size="sm"><Plus size={14} /> Add</Button>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : tags.length === 0 ? (
          <div className="py-10 text-center text-text-muted">No tags yet. Add your first tag above.</div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                {editingId === tag.id ? (
                  <>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(tag.id); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                      className="flex-1 bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent text-sm" />
                    <button onClick={() => saveEdit(tag.id)} className="p-1.5 rounded text-success hover:bg-success/10 transition-colors"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-text-muted hover:bg-surface transition-colors"><X size={14} /></button>
                  </>
                ) : deletingId === tag.id ? (
                  <>
                    <span className="flex-1 text-sm text-text-primary">
                      Delete &quot;{tag.name}&quot;?
                      {(tag._count?.timeEntries ?? 0) > 0 && (
                        <span className="text-warning ml-2 text-xs">(used in {tag._count?.timeEntries} entries)</span>
                      )}
                    </span>
                    <button onClick={() => deleteTag(tag.id)} className="px-2.5 py-1 rounded bg-danger/10 border border-danger/30 text-danger text-xs hover:bg-danger/20 transition-colors">Delete</button>
                    <button onClick={() => setDeletingId(null)} className="px-2.5 py-1 rounded bg-surface-elevated border border-border text-text-muted text-xs hover:text-text-primary transition-colors">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-text-primary">{tag.name}</span>
                    {(tag._count?.timeEntries ?? 0) > 0 && (
                      <span className="text-xs text-text-muted">{tag._count?.timeEntries} entries</span>
                    )}
                    <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); }}
                      className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => setDeletingId(tag.id)}
                      className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
