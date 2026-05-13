"use client";

import { useMemo } from "react";
import { TimeEntry } from "@/types";
import { formatDate, formatDuration } from "@/lib/utils";
import TimeEntryItem from "./TimeEntryItem";
import { SkeletonList } from "@/components/ui/Skeleton";

interface Props {
  entries: TimeEntry[];
  loading: boolean;
  total: number;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onRestart: (entry: TimeEntry) => void;
  onLoadMore: () => void;
}

export default function TimeEntryList({
  entries,
  loading,
  total,
  onEdit,
  onDelete,
  onRestart,
  onLoadMore,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const entry of entries) {
      const day = new Date(entry.startTime).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(entry);
    }
    return map;
  }, [entries]);

  if (loading && entries.length === 0) return <div className="p-4"><SkeletonList rows={5} /></div>;

  if (!loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-text-muted text-lg font-medium">No time entries yet</p>
        <p className="text-text-muted text-sm mt-1">Start the timer above to track your first entry</p>
      </div>
    );
  }

  return (
    <div>
      {Array.from(grouped.entries()).map(([day, dayEntries]) => {
        const dayTotal = dayEntries.reduce((s, e) => s + (e.duration ?? 0), 0);
        return (
          <div key={day} className="border-b border-border last:border-b-0">
            <div className="flex items-center justify-between px-4 py-2 bg-background sticky top-0">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {formatDate(day + "T12:00:00")}
              </span>
              <span className="text-xs font-mono text-text-muted">{formatDuration(dayTotal)}</span>
            </div>
            {dayEntries.map((entry) => (
              <TimeEntryItem
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                onRestart={onRestart}
              />
            ))}
          </div>
        );
      })}

      {entries.length < total && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="text-accent hover:text-accent-hover text-sm font-medium"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
