"use client";

import { useState } from "react";
import { MoreHorizontal, RotateCcw, Pencil, Trash2, DollarSign } from "lucide-react";
import { TimeEntry } from "@/types";
import { formatDuration, formatTime, cn } from "@/lib/utils";
import Badge from "@/components/ui/Badge";

interface Props {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onRestart: (entry: TimeEntry) => void;
}

export default function TimeEntryItem({ entry, onEdit, onDelete, onRestart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated transition-colors group">
      {/* Left: description + meta */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", entry.description ? "text-text-primary" : "text-text-muted italic")}>
          {entry.description || "No description"}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {entry.project && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.project.color }} />
              {entry.project.name}
              {entry.project.client && ` · ${entry.project.client.name}`}
            </span>
          )}
          {entry.tags?.map(({ tag }) => (
            <Badge key={tag.id} variant="default" className="text-xs">{tag.name}</Badge>
          ))}
        </div>
      </div>

      {/* Right: meta + actions */}
      <div className="flex items-center gap-3 shrink-0">
        {entry.billable && (
          <DollarSign size={14} className="text-success" />
        )}
        <span className="text-xs text-text-muted hidden md:block">
          {formatTime(entry.startTime)} – {entry.endTime ? formatTime(entry.endTime) : "…"}
        </span>
        <span className="font-mono text-sm text-text-primary">
          {formatDuration(entry.duration ?? 0)}
        </span>

        <button
          onClick={() => onRestart(entry)}
          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Restart"
        >
          <RotateCcw size={14} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 py-1 min-w-[120px]"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { onEdit(entry); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-elevated"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => { onDelete(entry.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-elevated"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
