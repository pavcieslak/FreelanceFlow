"use client";

import { useState, useEffect, useCallback } from "react";
import TimerBar from "@/components/tracker/TimerBar";
import TimeEntryList from "@/components/tracker/TimeEntryList";
import EditEntryModal from "@/components/tracker/EditEntryModal";
import TrackerCalendar from "@/components/tracker/TrackerCalendar";
import { TimeEntry, Project, Tag } from "@/types";

export default function TrackerPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    fetch("/api/projects?archived=false")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => {});
  }, []);

  const loadEntries = useCallback(async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const res = await fetch(`/api/time-entries?page=${p}&limit=50`);
      const data = await res.json();
      setEntries((prev) => (reset || p === 1 ? data.entries : [...prev, ...data.entries]));
      setTotal(data.total);
      if (reset) setPage(1);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadEntries(true);
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    loadEntries(true);
  }

  function handleRestart(entry: TimeEntry) {
    // The TimerBar handles this by watching for a restart signal
    // For simplicity we just set project + description in a new timer
    // This is handled via a prop callback
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TimerBar
        projects={projects}
        tags={tags}
        onEntryCreated={() => loadEntries(true)}
      />
      <TrackerCalendar projects={projects} onBookingCreated={() => loadEntries(true)} />
      <div className="flex-1 overflow-y-auto">
        <TimeEntryList
          entries={entries}
          loading={loading}
          total={total}
          onEdit={setEditEntry}
          onDelete={handleDelete}
          onRestart={() => {}}
          onLoadMore={() => {
            setPage((p) => p + 1);
            loadEntries(false);
          }}
        />
      </div>
      <EditEntryModal
        entry={editEntry}
        projects={projects}
        tags={tags}
        onClose={() => setEditEntry(null)}
        onSaved={() => loadEntries(true)}
      />
    </div>
  );
}
